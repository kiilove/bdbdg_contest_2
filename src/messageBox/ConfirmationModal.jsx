import { Modal } from "@mui/material";
import React from "react";

const ConfirmationModal = ({ isOpen, onConfirm, onCancel, message = {} }) => {
  const handleConfirmClick = () => {
    if (onConfirm) onConfirm();
  };

  const handleCancelClick = () => {
    if (onCancel) onCancel();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleCancelClick();
    }
  };

  return (
    <Modal open={Boolean(isOpen)} onClose={handleCancelClick}>
      <div
        className="w-[384px] max-w-[calc(100vw-32px)] bg-white rounded-[12px] border border-[#171717]/[0.08] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] absolute top-1/2 left-1/2 focus:outline-none"
        style={{
          transform: "translate(-50%, -50%)",
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="flex flex-col gap-1.5 text-center">
          {message.body && (
            <h2 className="text-[16px] leading-6 font-medium text-[#171717] m-0">
              {message.body}
            </h2>
          )}
          {message.body2 && (
            <p className="text-[14px] leading-5 font-medium text-[#525252] m-0">
              {message.body2}
            </p>
          )}
          {message.body3 && (
            <p className="text-[14px] leading-5 font-normal text-[#525252] m-0">
              {message.body3}
            </p>
          )}
          {message.body4 && (
            <p className="text-[13px] leading-5 font-normal text-[#737373] mt-1 mb-0">
              {message.body4}
            </p>
          )}
        </div>

        {message.isButton === true && (
          <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#171717]/[0.06]">
            {message.cancelButtonText && (
              <button
                type="button"
                onClick={handleCancelClick}
                className="min-w-[88px] h-[36px] px-4 rounded-[8px] bg-[#f4f4f5] hover:bg-[#e4e4e7] active:scale-[0.98] border border-[#171717]/[0.08] text-[13px] leading-5 font-medium text-[#171717] transition-[background-color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40"
              >
                {message.cancelButtonText}
              </button>
            )}
            {message.confirmButtonText && (
              <button
                type="button"
                onClick={handleConfirmClick}
                className="min-w-[88px] h-[36px] px-4 rounded-[8px] bg-[#dc2626] hover:bg-[#b91c1c] active:scale-[0.98] text-[13px] leading-5 font-medium text-white transition-[background-color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#dc2626]/40"
              >
                {message.confirmButtonText}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
