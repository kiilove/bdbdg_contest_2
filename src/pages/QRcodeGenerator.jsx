import React, { useState } from "react";
import { QRCode } from "antd";
import { Download, QrCode as QrCodeIcon } from "lucide-react";

const PRESET_URLS = [
  { label: "관리 페이지", url: "https://contest-bdbdg.web.app" },
  { label: "심사 페이지", url: "https://score-bdbdg.web.app/setting" },
  { label: "심판 등록", url: "https://judge.bdbdg.kr/" },
];

const QRCodeGenerator = () => {
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (value) => {
    setInputValue(value);
  };

  function doDownload(url, fileName) {
    const a = document.createElement("a");
    a.download = fileName;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const downloadCanvasQRCode = () => {
    const canvas = document.getElementById("qrcode")?.querySelector("canvas");
    if (canvas) {
      const url = canvas.toDataURL();
      doDownload(url, `${inputValue || "qrcode"}.png`);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-[1440px] mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              QR 코드 생성기
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              대회 관리, 심사석 접속, 심판 등록용 고해상도 QR 이미지를 생성하고 내려받습니다
            </p>
          </div>
          <div>
            <button
              type="button"
              disabled={!inputValue.trim()}
              onClick={() => downloadCanvasQRCode()}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#f4f4f5] disabled:text-[#737373] disabled:border disabled:border-[#171717]/[0.08] text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <Download size={16} strokeWidth={1.5} />
              <span>PNG 다운로드</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-5 bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#525252]">
                대상 주소 또는 텍스트
              </label>
              <input
                type="text"
                placeholder="https:// 주소를 입력하거나 아래 프리셋을 선택하세요"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full h-9 rounded-[8px] bg-white border border-[#171717]/[0.12] px-3 text-[14px] text-[#171717] placeholder:text-[#737373] focus:outline-none focus:border-[#2563eb] transition-colors duration-150"
              />
            </div>

            <div className="space-y-2">
              <span className="block text-[12px] font-medium text-[#737373]">
                빠른 프리셋 선택
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESET_URLS.map((preset) => {
                  const isActive = inputValue === preset.url;
                  return (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setInputValue(() => preset.url)}
                      className={`h-9 px-3.5 rounded-[8px] text-[13px] font-medium border transition-colors duration-150 ${
                        isActive
                          ? "bg-[#2563eb]/[0.08] border-[#2563eb]/40 text-[#2563eb]"
                          : "bg-[#f4f4f5] hover:bg-[#e4e4e7] border-[#171717]/[0.08] text-[#171717]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#f4f4f5] rounded-[8px] p-3.5 space-y-1 border border-[#171717]/[0.06]">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#737373]">출력 해상도</span>
                <span className="font-mono tabular-nums text-[#525252]">
                  500 × 500 px
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#737373]">오류 복원 수준</span>
                <span className="font-mono tabular-nums text-[#525252]">
                  Level H · 30%
                </span>
              </div>
            </div>
          </section>

          <section
            id="qrcode"
            className="lg:col-span-7 bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-6 flex flex-col items-center justify-center gap-4"
          >
            <div className="p-4 bg-white rounded-[8px] border border-[#171717]/[0.08] [&_canvas]:max-w-full [&_canvas]:h-auto">
              <QRCode
                type="canvas"
                value={inputValue || " "}
                size={500}
                errorLevel="H"
                bgColor="#ffffff"
                style={{ width: 280, height: 280 }}
              />
            </div>
            <div className="flex items-center gap-2 text-center max-w-full px-3 py-1.5 rounded-[6px] bg-[#f4f4f5]">
              <QrCodeIcon size={14} strokeWidth={1.5} className="text-[#737373] shrink-0" />
              <span className="font-mono text-[12px] text-[#525252] break-all">
                {inputValue || "입력된 주소 없음"}
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
