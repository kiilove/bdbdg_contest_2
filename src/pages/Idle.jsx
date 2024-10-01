import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import { useLocation, useNavigate } from "react-router-dom";
import background from "../assets/img/darkBackground_upscale.png";
import sbbf from "../assets/img/sbbf_idlebackground.png";

const Idle = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sponsorRef = useRef(null); // 스폰서 로고에 대한 참조
  const [contestId, setContestId] = useState("");
  const {
    data: realtimeData,
    loading: realtimeLoading,
    error: realtimeError,
  } = useFirebaseRealtimeGetDocument(
    contestId ? `currentStage/${contestId}` : null
  );

  // 스폰서 목록
  const sponsors = [
    { id: 1, name: "Sponsor 1", color: "#FF5733" },
    { id: 2, name: "Sponsor 2", color: "#33FF57" },
    { id: 3, name: "Sponsor 3", color: "#3357FF" },
    { id: 4, name: "Sponsor 4", color: "#FF33A1" },
    { id: 5, name: "Sponsor 5", color: "#33FFA1" },
    // 필요한 만큼 스폰서 추가
  ];

  useEffect(() => {
    if (location?.state?.contestId) {
      setContestId(location.state.contestId);
    }
  }, [location]);

  useEffect(() => {
    if (realtimeData?.screen?.status?.playStart) {
      navigate("/ranking", { state: { contestId } });
    }
  }, [realtimeData]);

  // GSAP 애니메이션 설정
  useEffect(() => {
    const sponsorLogos = sponsorRef.current;
    const logoWidth = sponsorLogos.firstChild.offsetWidth; // 로고 한 개의 너비
    const totalWidth = logoWidth * sponsorLogos.children.length; // 전체 가로 길이

    // 부드러운 무한 반복 애니메이션
    gsap.fromTo(
      sponsorLogos,
      { x: 0 },
      {
        x: -totalWidth, // 로고가 전체 너비만큼 이동
        duration: 3250, // 애니메이션 시간 (필요에 따라 조정)
        ease: "linear", // 일정한 속도로 움직임
        repeat: -1, // 무한 반복
        modifiers: {
          x: gsap.utils.unitize((x) => parseFloat(x) % totalWidth), // 위치를 계속 순환하도록 설정
        },
      }
    );
  }, []);

  // 스폰서 목록을 100번 반복
  const repeatedSponsors = Array.from({ length: 100 }, () => sponsors).flat();

  return (
    <div
      className="w-full h-screen flex justify-center items-center relative"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex flex-col w-full h-full justify-center items-center relative">
        {/* SBBF 이미지 */}
        <img
          src={sbbf}
          alt="SBBF Logo"
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "35%",
            height: "auto",
            opacity: 0.8,
          }}
        />

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
        <div className="absolute bottom-0 w-full overflow-hidden bg-black bg-opacity-70">
          <div
            ref={sponsorRef}
            className="sponsor-logos flex whitespace-nowrap"
            style={{ padding: "10px 0" }}
          >
            {/* 100번 반복된 스폰서 로고 */}
            {repeatedSponsors.map((sponsor, index) => (
              <div
                key={sponsor.id + "_" + index}
                className="sponsor-logo mx-5 bg-gray-300 text-black font-bold flex items-center justify-center"
                style={{
                  width: "250px",
                  height: "150px",
                  backgroundColor: sponsor.color,
                }}
              >
                {sponsor.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Idle;
