// Idle.jsx

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useFirebaseRealtimeGetDocument } from "../hooks/useFirebaseRealtime";
import { useLocation, useNavigate } from "react-router-dom";
import background from "../assets/img/darkBackground_upscale.png";
import ybbf from "../assets/img/ybbf_idlebackground.png";

import sbbf from "../assets/img/sbbf_idlebackground.png";
import gbbf from "../assets/img/gbbf_idlebackground.png";
import ybbf_mp4 from "../assets/mov/ybbf_mp4.mp4";
import { useFirestoreQuery } from "../hooks/useFirestores";
import { where } from "firebase/firestore";

const Idle = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sponsorRef = useRef(null); // 스폰서 로고에 대한 참조
  const [contestId, setContestId] = useState("");
  const [sponsors, setSponsors] = useState([]);

  // 커서 가시성 상태 관리
  const [isCursorVisible, setIsCursorVisible] = useState(true);
  const isCursorVisibleRef = useRef(isCursorVisible); // Ref로 상태 추적
  const cursorTimerRef = useRef(null);

  // Ref 업데이트
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

  // GSAP 애니메이션 설정
  useEffect(() => {
    if (sponsors.length > 0 && sponsorRef.current) {
      // 이미지와 DOM 요소가 렌더링되기까지 대기
      setTimeout(() => {
        const sponsorLogos = sponsorRef.current;
        if (!sponsorLogos.firstChild) {
          console.log("No sponsor logos found.");
          return;
        }
        const logoWidth = sponsorLogos.firstChild.offsetWidth; // 로고 한 개의 너비
        const totalWidth = logoWidth * sponsorLogos.children.length; // 전체 가로 길이

        console.log("Starting GSAP animation with totalWidth:", totalWidth);

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
      }, 1000); // 1초 정도 대기 후 애니메이션 실행
    }
  }, [sponsors]);

  // 스폰서 목록을 100번 반복
  const repeatedSponsors = Array.from({ length: 100 }, () => sponsors).flat();

  // 커서 가시성 관리
  useEffect(() => {
    const handleMouseMove = () => {
      console.log("Mouse moved");
      if (!isCursorVisibleRef.current) {
        setIsCursorVisible(true);
        console.log("Cursor made visible");
      }

      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        console.log("Existing cursor hide timer cleared");
      }

      cursorTimerRef.current = setTimeout(() => {
        setIsCursorVisible(false);
        console.log("Cursor hidden after 2 seconds of inactivity");
      }, 2000); // 2000ms = 2초
    };

    // 마우스 이동 이벤트 리스너 추가
    window.addEventListener("mousemove", handleMouseMove);
    console.log("Mousemove event listener added");

    // 초기 타이머 설정
    handleMouseMove();

    // 컴포넌트 언마운트 시 정리
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      console.log("Mousemove event listener removed");
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        console.log("Cursor hide timer cleared on unmount");
      }
    };
  }, []); // 빈 배열로 의존성 제한

  // isCursorVisible 상태 변경 시 로그 출력
  useEffect(() => {
    console.log("isCursorVisible state changed to:", isCursorVisible);
  }, [isCursorVisible]);

  return (
    <div
      className="fixed top-0 left-0 w-full h-full flex justify-center items-center z-50"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        cursor: isCursorVisible ? "auto" : "none", // 인라인 스타일로 커서 제어
        pointerEvents: "auto",
      }}
    >
      <div className="flex flex-col w-full h-full justify-center items-center relative">
        {/* YBBF 이미지 */}
        {/* <img
          src={gbbf}
          alt="GBBF Logo"
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "45%",
            height: "auto",
            opacity: 0.8,
          }}
        /> */}
        <video
          src={ybbf_mp4}
          alt="YBBF_동영상"
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "100%",
            height: "auto",
            opacity: 0.8,
          }}
          muted
          autoPlay
          loop
        />

        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full flex justify-center items-center">
          <div
            className="bg-black bg-opacity-50 p-5 rounded-lg flex justify-center items-center"
            style={{
              width: "90%",
            }}
          >
            {realtimeData?.categoryTitle && realtimeData?.gradeTitle && (
              <h1
                className="font-bold text-transparent bg-clip-text flex items-center justify-center h-full m-0" // h-auto를 h-full로 변경하고 m-0 추가
                style={{
                  fontSize: "5rem",
                  backgroundImage: "linear-gradient(90deg, #ffffff, #d4d4d4)",
                  textShadow: "2px 2px 10px rgba(0, 0, 0, 0.4)",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  lineHeight: "1.2", // lineHeight 값 수정
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
            {/* 100번 반복된 스폰서 로고 */}
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
                    style={{ maxWidth: "100px", maxHeight: "100px" }} // 이미지 크기 제한
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/path/to/default-image.png"; // 로딩 실패 시 대체 이미지
                    }}
                  />
                ) : (
                  <span>{sponsor.name}</span> // 이미지가 없을 경우 텍스트 표시
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
