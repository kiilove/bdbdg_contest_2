import React from "react";

/**
 * 🏛️ 정통 올림픽 & 로마 황금 월계관 가지 SVG (단일 가지)
 * - 줄기 곡선과 모든 잎사귀의 시작점이 100% 수학적으로 일치하여 완벽한 일체형 실루엣을 제공
 * - side="left" (좌측 안쪽으로 감싸는 곡선) / side="right" (우측 안쪽으로 감싸는 곡선)
 */
export const LaurelBranch = ({
  side = "left",
  className = "w-16 h-32 sm:w-24 sm:h-48 lg:w-32 lg:h-64",
}) => {
  const isRight = side === "right";
  const gradId = `laurelGoldGrad_${side}`;
  const veinId = `laurelVeinGrad_${side}`;

  return (
    <svg
      viewBox="0 0 160 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0 filter drop-shadow-[0_0_24px_rgba(251,191,36,0.95)] animate-pulse ${
        isRight ? "transform -scale-x-100" : ""
      }`}
    >
      <defs>
        {/* 황금빛 5단 입체 그라데이션 */}
        <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#78350f" />
          <stop offset="25%" stopColor="#b45309" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="80%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        {/* 잎맥 광원 하이라이트 */}
        <linearGradient id={veinId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* 🌿 메인 줄기 (하단 밑동 130,260 ➜ 상단 끝 115,20) */}
      <path
        d="M 130,260 C 30,200 15,80 115,20"
        stroke={`url(#${gradId})`}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* 👑 [최상단 팁 마디 (115, 20)] */}
      <path
        d="M 115,20 Q 95,6 122,-6 Q 130,8 115,20 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.2"
      />
      <path
        d="M 115,20 Q 118,7 122,-6"
        stroke={`url(#${veinId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* 🌿 [1번 마디 (95, 45)] */}
      {/* 외측 잎사귀 */}
      <path
        d="M 95,45 Q 60,38 60,18 Q 88,22 95,45 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.2"
      />
      <path
        d="M 95,45 Q 77,32 60,18"
        stroke={`url(#${veinId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* 내측 잎사귀 */}
      <path
        d="M 95,45 Q 112,24 135,26 Q 124,48 95,45 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.2"
      />
      <path
        d="M 95,45 Q 115,35 135,26"
        stroke={`url(#${veinId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* 🌿 [2번 마디 (60, 85)] */}
      {/* 외측 잎사귀 */}
      <path
        d="M 60,85 Q 22,76 18,52 Q 50,56 60,85 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.4"
      />
      <path
        d="M 60,85 Q 39,68 18,52"
        stroke={`url(#${veinId})`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 내측 잎사귀 */}
      <path
        d="M 60,85 Q 82,58 108,65 Q 94,92 60,85 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.4"
      />
      <path
        d="M 60,85 Q 84,75 108,65"
        stroke={`url(#${veinId})`}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 🌿 [3번 중앙 마디 (38, 135)] - 최대 볼륨 */}
      {/* 외측 잎사귀 */}
      <path
        d="M 38,135 Q -4,124 -2,98 Q 30,102 38,135 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.5"
      />
      <path
        d="M 38,135 Q 17,116 -2,98"
        stroke={`url(#${veinId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* 내측 잎사귀 */}
      <path
        d="M 38,135 Q 62,106 88,115 Q 74,144 38,135 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.5"
      />
      <path
        d="M 38,135 Q 63,125 88,115"
        stroke={`url(#${veinId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* 🌿 [4번 하중 마디 (38, 188)] */}
      {/* 외측 잎사귀 */}
      <path
        d="M 38,188 Q -2,180 0,154 Q 30,156 38,188 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.5"
      />
      <path
        d="M 38,188 Q 18,171 0,154"
        stroke={`url(#${veinId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* 내측 잎사귀 */}
      <path
        d="M 38,188 Q 64,158 90,170 Q 76,198 38,188 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.5"
      />
      <path
        d="M 38,188 Q 64,179 90,170"
        stroke={`url(#${veinId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* 🌿 [5번 밑동 마디 (68, 235)] */}
      {/* 외측 잎사귀 */}
      <path
        d="M 68,235 Q 26,236 28,208 Q 60,206 68,235 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.5"
      />
      <path
        d="M 68,235 Q 48,221 28,208"
        stroke={`url(#${veinId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* 내측 잎사귀 */}
      <path
        d="M 68,235 Q 98,208 122,222 Q 104,250 68,235 Z"
        fill={`url(#${gradId})`}
        stroke="#78350f"
        strokeWidth="1.5"
      />
      <path
        d="M 68,235 Q 95,228 122,222"
        stroke={`url(#${veinId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 👑 선수 성명을 양옆에서 감싸 안는 일체형 월계관 날개 컨테이너
 */
export const LaurelWreathWings = ({
  children,
  className = "flex items-center justify-center gap-2 sm:gap-4 py-2",
  branchClassName = "w-16 h-32 sm:w-24 sm:h-48 lg:w-32 lg:h-64",
}) => {
  return (
    <div className={className}>
      <LaurelBranch side="left" className={branchClassName} />
      {children}
      <LaurelBranch side="right" className={branchClassName} />
    </div>
  );
};

export default LaurelWreathWings;
