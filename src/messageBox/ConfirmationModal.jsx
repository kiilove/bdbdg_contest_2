import { Modal } from "@mui/material";
import React from "react";

const ConfirmationModal = ({ isOpen, onConfirm, onCancel, message }) => {
  const handleConfirmClick = () => {
    onConfirm();
  };

  const handleCancelClick = () => {
    onCancel();
  };
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleCancelClick();
    }
  };
  return (
    <div>
      <Modal open={isOpen} onClose={handleCancelClick}>
        <div
          className="flex flex-col w-96 bg-white justify-center items-center absolute top-1/2 left-1/2 gap-y-2 rounded-lg border p-8"
          style={{
            transform: "translate(-50%, -50%)",
          }}
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-col gap-y-2 text-black items-center">
            <h2 className="font-semibold">{message.body}</h2>
            {message.body2 && (
              <h2 className="font-semibold">{message.body2}</h2>
            )}
            {message.body3 && (
              <h2 className="font-semibold">{message.body3}</h2>
            )}
            {message.body4 && (
              <h2 className="text-sm font-normal">{message.body4}</h2>
            )}
          </div>
          {message.isButton === true && (
            <div className="flex justify-center gap-x-5 mt-5">
              {message.confirmButtonText && (
                <button
                  className="bg-red-500 hover:bg-red-700 text-white rounded py-1 px-4 text-sm"
                  onClick={handleConfirmClick}
                  style={{ minWidth: "100px" }}
                >
                  {message.confirmButtonText}
                </button>
              )}
              {message.cancelButtonText && (
                <button
                  className="bg-gray-300 hover:bg-gray-500 rounded py-2 px-4 mr-4 text-sm"
                  onClick={handleCancelClick}
                  style={{ minWidth: "100px" }}
                >
                  {message.cancelButtonText}
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ConfirmationModal;
