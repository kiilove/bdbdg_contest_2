import { useState, useEffect } from "react";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getMetadata,
  updateMetadata,
} from "firebase/storage";
import ColorThief from "colorthief";
import { compressImage } from "./imageUtils";

const DEFAULT_COLOR_PALETTE = [
  [59, 130, 246],
  [6, 182, 212],
  [30, 41, 59],
  [100, 116, 139],
  [241, 245, 249],
];

const buildColorTheme = (palette) => {
  const validColors = Array.isArray(palette)
    ? palette.filter((rgb) => Array.isArray(rgb) && rgb.length >= 3)
    : [];

  return Array.from({ length: 5 }, (_, idx) => {
    const rgb =
      validColors[idx] ||
      validColors[0] ||
      DEFAULT_COLOR_PALETTE[idx] ||
      DEFAULT_COLOR_PALETTE[0];
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  });
};

const useFirebaseStorage = (files, storagePath) => {
  const [progress, setProgress] = useState(0);
  const [urls, setUrls] = useState([]);
  const [errors, setErrors] = useState([]);
  const [representativeImage, setRepresentativeImage] = useState(null);

  useEffect(() => {
    if (!files || files.length === 0 || !storagePath) {
      setProgress(0);
      setUrls((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    let cancelled = false;
    const activeObjectUrls = new Set();

    const storage = getStorage();
    const originalRef = ref(storage, `${storagePath}/original`);
    const compressRef = ref(storage, `${storagePath}/compress`);

    const promises = Array.from(files).map((file, index) => {
      const metadataPromise = getMetadata(ref(storage, file.name)).catch(
        () => null
      );

      return Promise.all([metadataPromise]).then(async ([existingMetadata]) => {
        try {
          if (existingMetadata && existingMetadata.size === file.size) {
            const existingCustomMeta = existingMetadata.customMetadata || {};
            setUrls((prevUrls) => [
              ...prevUrls,
              {
                url: existingCustomMeta.compressedUrl || "",
                ...existingCustomMeta,
              },
            ]);
            return null;
          }

          const maxSize = 1024 * 1024;
          const compressOptions = { maxWidthOrHeight: 1024, quality: 0.5 };
          const shouldCompress = file.size > maxSize;
          const compressedFile = shouldCompress
            ? await compressImage(file, compressOptions)
            : file;

          const randomSuffix = Math.random().toString(36).slice(2, 8);
          const newName = `bdbdg_${Date.now()}_${index}_${randomSuffix}`;
          const uploadRef = shouldCompress
            ? ref(compressRef, newName)
            : ref(originalRef, newName);
          const uploadMetadata = {
            contentType: compressedFile.type,
            customMetadata: {
              url: "",
            },
          };

          // ColorThief 라이브러리를 사용하여 테마 색상 추출
          const objectUrl = URL.createObjectURL(compressedFile);
          activeObjectUrls.add(objectUrl);

          let extractedPalette = DEFAULT_COLOR_PALETTE;
          try {
            extractedPalette = await new Promise((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                try {
                  const colorThief = new ColorThief();
                  const palette = colorThief.getPalette(img, 5);
                  resolve(palette);
                } catch (paletteErr) {
                  console.warn("ColorThief palette fallback:", paletteErr);
                  resolve(DEFAULT_COLOR_PALETTE);
                }
              };
              img.onerror = () => {
                reject(new Error(`Failed to decode image: ${file.name}`));
              };
              img.src = objectUrl;
            });
          } finally {
            URL.revokeObjectURL(objectUrl);
            activeObjectUrls.delete(objectUrl);
          }

          const colorTheme = buildColorTheme(extractedPalette);

          const uploadTask = uploadBytesResumable(
            uploadRef,
            compressedFile,
            uploadMetadata
          );

          return new Promise((resolve) => {
            uploadTask.on(
              "state_changed",
              (snapshot) => {
                if (cancelled) return;
                const nextProgress = snapshot.totalBytes
                  ? Math.round(
                      (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    )
                  : 0;
                setProgress(nextProgress);
              },
              (error) => {
                if (!cancelled) {
                  setErrors((prevErrors) => [
                    ...prevErrors,
                    { name: file.name, error },
                  ]);
                }
                resolve(null);
              },
              async () => {
                try {
                  const downloadURL = await getDownloadURL(uploadRef);
                  const originalUrl = shouldCompress
                    ? uploadMetadata.customMetadata.url
                    : downloadURL;
                  const compressedUrl = shouldCompress
                    ? downloadURL
                    : originalUrl;

                  const customMetadata = {
                    name: compressedFile.name,
                    contentDisposition: `attachment; filename="${compressedFile.name}"`,
                    colorTheme,
                  };

                  // 이미지 메타데이터 업데이트
                  try {
                    await updateMetadata(uploadRef, {
                      customMetadata: {
                        name: customMetadata.name,
                        contentDisposition: customMetadata.contentDisposition,
                        colorTheme: JSON.stringify(colorTheme),
                      },
                    });
                  } catch (error) {
                    console.error(error);
                  }

                  const image = {
                    url: originalUrl,
                    compressedUrl,
                    ...customMetadata,
                  };

                  if (!cancelled) {
                    setUrls((prevUrls) => [...prevUrls, image]);
                    if (index === 0) {
                      setRepresentativeImage(image);
                    }
                  }

                  resolve(image);
                } catch (completeErr) {
                  if (!cancelled) {
                    setErrors((prevErrors) => [
                      ...prevErrors,
                      { name: file.name, error: completeErr },
                    ]);
                  }
                  resolve(null);
                }
              }
            );
          }).then((image) => {
            if (!image) {
              return null;
            }
            const { url, compressedUrl, ...metadata } = image;
            const finalUrl = compressedUrl || url;
            return {
              url,
              compressedUrl: compressedUrl ? finalUrl : null,
              ...metadata,
            };
          });
        } catch (fileError) {
          if (!cancelled) {
            setErrors((prevErrors) => [
              ...prevErrors,
              { name: file.name, error: fileError },
            ]);
          }
          return null;
        }
      });
    });

    Promise.all(promises).then((uploadedImages) => {
      if (cancelled) return;
      setProgress(0);
      const uploadedUrls = uploadedImages
        .filter((image) => image !== null)
        .map(({ url, compressedUrl, ...metadata }) => ({
          originalUrl: url,
          compressedUrl,
          ...metadata,
        }));
      setUrls(uploadedUrls);
    });

    return () => {
      cancelled = true;
      activeObjectUrls.forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
      });
      activeObjectUrls.clear();
    };
  }, [files, storagePath]);

  return { progress, urls, errors, representativeImage };
};

export default useFirebaseStorage;
