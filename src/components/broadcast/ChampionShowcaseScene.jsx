import React, { useEffect, useRef, useState, useMemo, useContext } from "react";
import { gsap } from "gsap";
import {
  TrophyOutlined,
  CrownOutlined,
  FireOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
} from "@ant-design/icons";
import { where } from "firebase/firestore";
import { THEME_CONFIGS } from "./AthleteIntroScene";
import { LaurelBranch } from "./LaurelWreathWings";
import { CurrentContestContext } from "../../contexts/CurrentContestContext";
import { useFirestoreQuery } from "../../hooks/useFirestores";
import "./AthleteIntroScene.css";

const ChampionShowcaseScene = ({
  contestTitle,
  stageInfo,
  topPlayer,
  backgroundVideoUrl,
  colorTheme = "GOLD",
  onBackToRanking,
  onFinishCeremony,
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const flashRef = useRef(null);

  const { currentContest } = useContext(CurrentContestContext);
  const fetchResultQuery = useFirestoreQuery();
  const theme = THEME_CONFIGS[colorTheme] || THEME_CONFIGS.GOLD;

  // 🗄️ 현재 대회의 실제 등록 선수 목록에서 사진/이름/소속 실시간 조회 (누락 100% 방지)
  const [realPlayersMap, setRealPlayersMap] = useState({});

  useEffect(() => {
    const fetchRealPlayers = async () => {
      const cId = currentContest?.contests?.id || currentContest?.contestInfo?.id;
      if (!cId) return;
      try {
        const condition = [where("contestId", "==", cId)];
        const data = await fetchResultQuery.getDocuments("contest_players", condition);
        if (data && data.length > 0) {
          const map = {};
          data.forEach((p) => {
            if (p.playerNumber) map[String(p.playerNumber).trim()] = p;
            if (p.playerName) map[String(p.playerName).trim()] = p;
          });
          setRealPlayersMap(map);
        }
      } catch (e) {
        console.error("선수 데이터 로드 실패:", e);
      }
    };
    fetchRealPlayers();
  }, [currentContest?.contests?.id, currentContest?.contestInfo?.id]);

  const rawPNum = topPlayer?.playerNumber || "";
  const rawPName = topPlayer?.playerName || "";
  const matchedReal = realPlayersMap[String(rawPNum).trim()] || realPlayersMap[String(rawPName).trim()] || null;

  const hasChampionData = Boolean(
    topPlayer && (topPlayer.playerName || topPlayer.playerNumber || matchedReal)
  );

  // 🌟 실제 선수 데이터 완벽 바인딩
  const playerNumber = topPlayer?.playerNumber || matchedReal?.playerNumber || "-";
  const playerName = (topPlayer?.playerName && topPlayer?.playerName !== "데이터 없음")
    ? topPlayer.playerName
    : (matchedReal?.playerName || "1위 챔피언");
  const playerGym = (topPlayer?.playerGym && topPlayer?.playerGym !== "심사 결과 집계 대기")
    ? topPlayer.playerGym
    : (matchedReal?.playerGym || "공식 소속팀");

  // 🌟 실제 무대 사진 (stagePhoto1, stagePhoto2) 딱 2장만 전용 사용 (잡다한 프로필/갤러리 사진 제외)
  const photoList = React.useMemo(() => {
    if (!hasChampionData) return [];
    const p1 =
      topPlayer?.stagePhoto1 ||
      topPlayer?.stagePhotoUrl1 ||
      topPlayer?.stagePhotoUrl ||
      matchedReal?.stagePhoto1 ||
      matchedReal?.stagePhotoUrl1 ||
      matchedReal?.stagePhotoUrl ||
      "";
    const p2 =
      topPlayer?.stagePhoto2 ||
      topPlayer?.stagePhotoUrl2 ||
      matchedReal?.stagePhoto2 ||
      matchedReal?.stagePhotoUrl2 ||
      "";

    const isValidPhoto = (u) =>
      typeof u === "string" &&
      u.trim().length > 5 &&
      !u.toLowerCase().includes("poster") &&
      !u.toLowerCase().includes("banner") &&
      !u.toLowerCase().includes("logo") &&
      !u.toLowerCase().includes("certificate");

    const list = [p1, p2].filter(isValidPhoto);
    return Array.from(new Set(list));
  }, [topPlayer, matchedReal, hasChampionData]);

  // 📸 4.5초마다 2장의 stage 사진 슬라이딩 크로스페이드
  const [activePhotoIdx, setActivePhotoIdx] = React.useState(0);

  useEffect(() => {
    if (photoList.length <= 1) return;
    const sliderTimer = setInterval(() => {
      setActivePhotoIdx((prev) => (prev + 1) % photoList.length);
    }, 4500);
    return () => clearInterval(sliderTimer);
  }, [photoList.length]);

  const catTitle =
    stageInfo?.categoryTitle ||
    topPlayer?.contestCategoryTitle ||
    topPlayer?.categoryTitle ||
    matchedReal?.contestCategoryTitle ||
    "공식 종목";

  const getSingleGradeTitle = (rawGradeTitle, athlete, matched) => {
    if (athlete?.contestGradeTitle) return athlete.contestGradeTitle;
    if (athlete?.gradeTitle) return athlete.gradeTitle;
    if (matched?.contestGradeTitle) return matched.contestGradeTitle;
    if (matched?.gradeTitle) return matched.gradeTitle;
    if (!rawGradeTitle) return "";
    let cleaned = rawGradeTitle.replace(/\s*통합\s*/g, " ").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return parts[0];
    }
    return cleaned;
  };

  const grdTitle = getSingleGradeTitle(stageInfo?.gradeTitle, topPlayer, matchedReal);

  // 성명 글자별 키네틱 타이포그래피 분리
  const nameChars = playerName ? playerName.split("") : ["[", "1", "위", " ", "챔", "피", "언", "]"];

  // 🌟 [Canvas: 황금빛 챔피언 축하 스파크 & 엠버 물리 파티클 엔진]
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particleCount = 70;
    const particles = [];

    const sparkColors = [
      "rgba(251, 191, 36, ",
      "rgba(245, 158, 11, ",
      "rgba(254, 240, 138, ",
      "rgba(255, 255, 255, ",
    ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 3 + 1,
        colorBase: sparkColors[Math.floor(Math.random() * sparkColors.length)],
        alpha: Math.random() * 0.8 + 0.2,
        speedX: (Math.random() - 0.5) * 1.5,
        speedY: -(Math.random() * 2 + 0.8),
        pulseSpeed: Math.random() * 0.03 + 0.01,
        angle: Math.random() * Math.PI * 2,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.angle += p.pulseSpeed;

        const dynamicAlpha = Math.max(
          0.1,
          Math.min(1, p.alpha + Math.sin(p.angle) * 0.3)
        );

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.colorBase}${dynamicAlpha})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 🎬 [GSAP 챔피언 등장 웅장한 시네마틱 타격 연출]
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // 0. 초기 상태
      gsap.set(".champ-header", { opacity: 0, y: -30 });
      gsap.set(".champ-no-badge", { opacity: 0, scale: 0.8, x: -40 });
      gsap.set(".champ-name-container", { opacity: 0, scale: 0.7, y: 50 });
      gsap.set(".champ-gym-badge", { opacity: 0, y: 40, scale: 0.9 });
      gsap.set(".champ-hero-img", { opacity: 0, scale: 1.15, filter: "brightness(2)" });
      gsap.set(".champ-footer", { opacity: 0, y: 30 });

      // [0.0s] 화이트 플래시 폭발 & 서서히 페이드
      if (flashRef.current) {
        tl.fromTo(flashRef.current, { opacity: 0.8 }, { opacity: 0, duration: 0.8, ease: "power2.out" }, 0);
      }

      // [0.1s] 상단 헤더 슬라이드
      tl.to(".champ-header", { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.1);

      // [0.3s] 좌측 챔피언 사진 안착
      tl.to(
        ".champ-hero-img",
        {
          opacity: 1,
          scale: 1,
          filter: "brightness(1)",
          duration: 1.2,
          ease: "power3.out",
        },
        0.3
      );

      // [0.6s] 🥇 1ST 배부번호 & 체급 뱃지 쾅!
      tl.to(
        ".champ-no-badge",
        {
          opacity: 1,
          scale: 1,
          x: 0,
          duration: 0.6,
          ease: "back.out(1.8)",
        },
        0.6
      );

      // [0.9s] 👑 초대형 황금 월계관 & 선수 성명 웅장한 등장
      tl.to(
        ".champ-name-container",
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.9,
          ease: "elastic.out(1.1, 0.6)",
        },
        0.9
      );

      // [1.4s] 소속 클럽 뱃지 슬라이드
      tl.to(
        ".champ-gym-badge",
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          ease: "power3.out",
        },
        1.4
      );

      // [1.8s] 하단 바 표시
      tl.to(
        ".champ-footer",
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out",
        },
        1.8
      );
    }, containerRef);

    return () => ctx.revert();
  }, [hasChampionData, theme]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-transparent text-white flex flex-col justify-between p-6 sm:p-8 lg:p-10 overflow-hidden select-none"
    >
      {/* ⚡ [Layer 40: 순간 충격파 플래시] */}
      <div ref={flashRef} className="absolute inset-0 z-40 pointer-events-none bg-white opacity-0" />

      {/* ======================= [ Layer 30: 상단 공식 챔피언 헤더 바 ] ======================= */}
      <div className="champ-header relative z-30 flex items-center justify-between border-b border-white/15 pb-4">
        <div className="flex items-center gap-4">
          <div className={`w-3.5 h-10 rounded-full bg-gradient-to-b ${theme.textGradient}`} />
          <div>
            <div className={`text-xs font-black tracking-widest ${theme.primary} uppercase flex items-center gap-1.5`}>
              <FireOutlined className="animate-pulse" />
              <span>OFFICIAL 1ST PLACE WINNER • 공식 1위 단독 세레모니</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white m-0 tracking-tight leading-tight">
              {catTitle} <span className={`${theme.primary} ml-2 font-mono`}>{grdTitle}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/85 px-5 py-2 rounded-2xl border border-white/15 shadow-xl">
            {hasChampionData ? (
              <>
                <CheckCircleOutlined className="text-emerald-400 text-lg" />
                <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                  공식 1위 우승 확정
                </span>
              </>
            ) : (
              <>
                <FieldTimeOutlined className="text-amber-400 text-lg animate-pulse" />
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  심사 집계 중
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ======================= [ Layer 10: 메인 중앙 컨텐츠 영역 ] ======================= */}
      <div className={`relative z-10 my-auto flex flex-col ${photoList.length > 0 ? "lg:flex-row items-center justify-between px-6 lg:px-16" : "items-center justify-center w-full max-w-5xl mx-auto px-6 text-center"} gap-8 w-full h-[calc(100vh-170px)] py-2`}>
        
        {/* 좌측: 1위 챔피언 무대 사진 2장 슬라이더 (사진이 있을 때만 표출) */}
        {photoList.length > 0 && (
          <div className="relative flex items-center justify-center h-full max-h-[82vh] w-full lg:w-1/2">
            
            {/* 거대한 CHAMPION 워터마크 */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/[0.05] font-black text-[12rem] lg:text-[16rem] leading-none pointer-events-none select-none font-mono tracking-tighter">
              WINNER
            </div>

            {/* 림 라이트 글로우 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none"
              style={{ backgroundColor: theme.glowRgba }}
            />

            {/* 📸 stagePhoto1, stagePhoto2 (2장) 4.5초 슬라이더 */}
            <div className="champ-hero-img relative w-full h-full flex items-center justify-center">
              {photoList.map((photoUrl, pIdx) => {
                const isActive = pIdx === activePhotoIdx;
                return (
                  <img
                    key={`champ-p-${pIdx}`}
                    src={photoUrl}
                    alt={`${playerName} - stage ${pIdx + 1}`}
                    className={`absolute max-h-[80vh] w-auto object-contain hero-photo-flawless-mask drop-shadow-[0_30px_90px_rgba(0,0,0,0.98)] transition-opacity duration-700 ${
                      isActive
                        ? "opacity-100 scale-100 z-10"
                        : "opacity-0 scale-100 z-0 pointer-events-none"
                    }`}
                  />
                );
              })}
            </div>

            {/* 📸 2장 사진 인디케이터 닷 */}
            {photoList.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/85 px-4 py-1.5 rounded-full border border-white/15 shadow-xl">
                {photoList.map((_, dotIdx) => (
                  <div
                    key={dotIdx}
                    className={`h-2 rounded-full transition-all duration-500 ${
                      dotIdx === activePhotoIdx
                        ? "w-6 bg-amber-400 shadow-md shadow-amber-400/50"
                        : "w-2 bg-white/30"
                    }`}
                  />
                ))}
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-15" />
          </div>
        )}

        {/* 1위 챔피언 프로필 정보 (완벽한 수직/수평 중앙 정렬) */}
        <div className={`space-y-6 sm:space-y-8 w-full z-10 ${photoList.length > 0 ? "text-center lg:text-left lg:w-1/2" : "text-center mx-auto max-w-4xl"} flex flex-col items-center justify-center`}>
          
          {/* ① 배부번호 & 출전 종목/체급 바 (중앙 정렬) */}
          <div className="champ-no-badge inline-flex items-center justify-center gap-4">
            <span className={`px-5 py-1.5 rounded-2xl bg-black/90 border-2 ${theme.border} font-mono font-black text-2xl sm:text-3xl ${theme.primary} shadow-xl tracking-tighter`}>
              NO.{playerNumber}
            </span>

            <div className="text-left flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black text-white leading-tight">
                {catTitle}
              </span>
              {grdTitle && (
                <span className={`text-xl sm:text-2xl font-black ${theme.primary} font-mono`}>
                  {grdTitle}
                </span>
              )}
            </div>
          </div>

          {/* ② 🔥 [중앙 핵심]: 정통 로마/올림픽 황금 월계관 날개 + 초대형 1위 챔피언 성명 (완벽한 수평 대칭 센터) */}
          <div className="champ-name-container py-2 flex items-center justify-center gap-4 sm:gap-8 flex-nowrap w-full">
            <LaurelBranch side="left" />

            {/* 초대형 성명 */}
            <div className="text-7xl sm:text-8xl lg:text-9xl font-black tracking-tighter leading-none m-0 uppercase bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_20px_60px_rgba(251,191,36,0.65)] whitespace-nowrap">
              {playerName}
            </div>

            <LaurelBranch side="right" />
          </div>

          {/* ③ 선수 소속 클럽 / 체육관 (중앙 정렬) */}
          <div className="champ-gym-badge pt-1 flex justify-center w-full">
            <div className="inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-slate-950/95 border border-white/20 shadow-2xl">
              <TrophyOutlined className={`${theme.primary} text-2xl sm:text-3xl`} />
              <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                소속 : <span className={theme.primary}>{playerGym}</span>
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* 🌟 [Layer 25: 화면 전체를 가로지르는 황금빛 파티클 캔버스] */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-25" />

      {/* ======================= [ Layer 30: 하단 공식 방송 바 ] ======================= */}
      <div className="champ-footer relative z-30 flex items-center justify-between border-t border-white/15 pt-3 shrink-0">
        <div className="text-sm text-slate-300 font-bold flex items-center gap-2">
          <ThunderboltOutlined className={theme.primary} />
          <span>{contestTitle}</span>
        </div>

        <div className={`text-sm font-black tracking-widest ${theme.primary} font-mono`}>
          OFFICIAL CHAMPION
        </div>
      </div>
    </div>
  );
};

export default ChampionShowcaseScene;
