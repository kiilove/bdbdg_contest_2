// QRCodeGenerator.jsx

import React, { useState } from "react";
import { Input, Card, Button } from "antd";
import { QRCode } from "antd"; // antd의 QRCode 컴포넌트
import "antd/dist/reset.css"; // antd 스타일 임포트 (버전에 따라 경로 조정 필요)

const { Search } = Input;

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
      doDownload(url, `${inputValue}.png`);
    }
  };

  return (
    <Card
      title="QR 코드 생성기"
      style={{
        maxWidth: 600,
        margin: "50px auto",
        textAlign: "center",
        padding: "20px",
      }}
    >
      {/* 입력창 */}
      <Search
        placeholder="QR 코드에 포함할 텍스트를 입력하세요"
        enterButton="생성"
        size="large"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onSearch={(value) => handleInputChange(value)}
        style={{ marginBottom: 10 }}
      />

      {/* QR 코드 */}
      <div
        id="qrcode"
        className="flex-col"
        style={{ display: "flex", justifyContent: "center" }}
      >
        <div className="flex my-5 gap-x-2">
          <Button
            onClick={() => {
              setInputValue(() => "https://contest-bdbdg.web.app");
            }}
          >
            관리페이지
          </Button>
          <Button
            onClick={() => {
              setInputValue(() => "https://score-bdbdg.web.app/setting");
            }}
          >
            심사페이지
          </Button>
          <Button
            onClick={() => {
              setInputValue(() => "https://judge.bdbdg.kr/");
            }}
          >
            심판등록
          </Button>
        </div>
        <QRCode
          type="canvas"
          value={inputValue || " "} // 빈 문자열일 경우 공백으로 처리하여 QR 코드가 생성되지 않도록 함
          size={500} // QR 코드 크기 설정 (픽셀 단위)
          errorLevel="H" // 오류 정정 수준 (L, M, Q, H)
          bgColor="#fff"
        />
        <span className=" font-semibold text-xl my-5">{inputValue}</span>
        <Button type="primary" onClick={() => downloadCanvasQRCode()}>
          Download
        </Button>
      </div>
    </Card>
  );
};

export default QRCodeGenerator;
