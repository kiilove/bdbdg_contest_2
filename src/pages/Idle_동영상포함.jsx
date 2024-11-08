import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import { useLocation, useNavigate } from "react-router-dom";
import background from "../assets/img/darkBackground_upscale.png";
import gbbf from "../assets/img/gbbf_idlebackground.png";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";

const Idle = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sponsorRef = useRef(null);
  const videoRef = useRef(null);
  const [contestId, setContestId] = useState("");
  const [sponsors, setSponsors] = useState([]);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  const [isCursorVisible, setIsCursorVisible] = useState(true);
  const isCursorVisibleRef = useRef(isCursorVisible);
  const cursorTimerRef = useRef(null);

  useEffect(() => {
    isCursorVisibleRef.current = isCursorVisible;
    console.log("isCursorVisible state updated to:", isCursorVisible);
  }, [isCursorVisible]);

  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );
  const sponsorQuery = useFirestoreQuery();

  const fetchSponsors = async (contestId) => {
    const condition = [where("contestId", "==", contestId)];
    try {
      const data = await sponsorQuery.getDocuments(
        "contest_sponsor_list",
        condition
      );
      if (data.length > 0) {
        setSponsors([...data[0]?.sponsors]);
        console.log("Sponsors fetched:", data[0]?.sponsors);
      } else {
        console.log("No sponsors found for contestId:", contestId);
      }
    } catch (error) {
      console.error("Failed to fetch sponsors:", error);
    }
  };

  useEffect(() => {
    if (location?.state?.contestId) {
      setContestId(location.state.contestId);
      console.log("Contest ID set to:", location.state.contestId);
      fetchSponsors(location.state.contestId);
    }
  }, [location]);

  useEffect(() => {
    if (realtimeData?.screen?.status?.playStart) {
      console.log("Play started, navigating to /ranking");
      navigate("/ranking", { state: { contestId } });
    }
  }, [realtimeData, navigate, contestId]);

  useEffect(() => {
    if (sponsors.length > 0 && sponsorRef.current) {
      setTimeout(() => {
        const sponsorLogos = sponsorRef.current;
        if (!sponsorLogos.firstChild) {
          console.log("No sponsor logos found.");
          return;
        }
        const logoWidth = sponsorLogos.firstChild.offsetWidth;
        const totalWidth = logoWidth * sponsorLogos.children.length;

        console.log("Starting GSAP animation with totalWidth:", totalWidth);

        gsap.fromTo(
          sponsorLogos,
          { x: 0 },
          {
            x: -totalWidth,
            duration: 3250,
            ease: "linear",
            repeat: -1,
            modifiers: {
              x: gsap.utils.unitize((x) => parseFloat(x) % totalWidth),
            },
          }
        );
      }, 1000);
    }
  }, [sponsors]);

  const repeatedSponsors = Array.from({ length: 100 }, () => sponsors).flat();

  useEffect(() => {
    const handleMouseMove = () => {
      if (!isCursorVisibleRef.current) {
        setIsCursorVisible(true);
      }
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
      }
      cursorTimerRef.current = setTimeout(() => {
        setIsCursorVisible(false);
      }, 2000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    handleMouseMove();
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
      }
    };
  }, []);

  // 동영상 종료 시 이미지로 전환하고, 다시 재생하지 않음
  const handleVideoEnd = () => {
    setIsVideoPlaying(false); // isVideoPlaying을 false로 설정하여 이미지로 전환
  };

  return (
    <div
      className="fixed top-0 left-0 w-full h-full flex justify-center items-center z-50"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        cursor: isCursorVisible ? "auto" : "none",
        pointerEvents: "auto",
      }}
    >
      <div className="flex flex-col w-full h-full justify-center items-center relative">
        {isVideoPlaying ? (
          <video
            ref={videoRef}
            src="https://firebasestorage.googleapis.com/v0/b/bdbdgmain.appspot.com/o/video%2F2024_11_02%2016_08.mp4?alt=media&token=8327fff8-a974-4c23-989e-3c34ac76ee3e"
            autoPlay
            onEnded={handleVideoEnd}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "45%",
              height: "auto",
              opacity: 0.8,
            }}
          />
        ) : (
          <img
            src={gbbf}
            alt="GBBF Logo"
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "45%",
              height: "auto",
              opacity: 0.8,
            }}
          />
        )}

        {/* 반투명 배경을 포함한 텍스트 박스 */}
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full flex justify-center">
          <div
            className="bg-black bg-opacity-50 p-5 rounded-lg"
            style={{
              width: "90%",
            }}
          >
            {realtimeData?.categoryTitle && realtimeData?.gradeTitle && (
              <h1
                className="font-bold text-transparent bg-clip-text flex justify-center items-center"
                style={{
                  fontSize: "5rem",
                  backgroundImage: "linear-gradient(90deg, #ffffff, #d4d4d4)",
                  textShadow: "2px 2px 10px rgba(0, 0, 0, 0.4)",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                }}
              >
                {`${realtimeData.categoryTitle} ${realtimeData.gradeTitle}`}
              </h1>
            )}
          </div>
        </div>

        {/* 스폰서 로고가 포함된 배너 */}
        <div className="absolute bottom-0 w-full overflow-hidden bg-white ">
          <div
            ref={sponsorRef}
            className="sponsor-logos flex whitespace-nowrap"
          >
            {repeatedSponsors.map((sponsor, index) => (
              <div
                key={sponsor.id + "_" + index}
                className="sponsor-logo mx-5 bg-gray-300 text-black font-bold flex items-center justify-center"
                style={{
                  width: "250px",
                  height: "120px",
                  backgroundColor: "white",
                }}
              >
                {sponsor?.url ? (
                  <img
                    src={sponsor.url}
                    alt={`${sponsor.name} logo`}
                    style={{ maxWidth: "100px", maxHeight: "100px" }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/path/to/default-image.png";
                    }}
                  />
                ) : (
                  <span>{sponsor.name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Idle;
