import React, { useState } from "react";
import ConfirmationModal from "../../messageBox/ConfirmationModal";

const ConfirmModalTrigger = ({
  title,
  body,
  body2,
  body3,
  body4,
  variant = "warning",
  confirmText = "확인",
  cancelText = "취소",
  disabled = false,
  onConfirm,
  children,
}) => {
  const [open, setOpen] = useState(false);

  const handleOpen = (event) => {
    if (disabled || children?.props?.disabled) return;
    if (typeof children?.props?.onClick === "function") {
      children.props.onClick(event);
    }
    if (event?.defaultPrevented) return;
    setOpen(true);
  };

  const handleConfirm = () => {
    setOpen(false);
    if (typeof onConfirm === "function") {
      onConfirm();
    }
  };

  const triggerElement = React.isValidElement(children)
    ? React.cloneElement(children, {
        onClick: handleOpen,
      })
    : children;

  return (
    <>
      {triggerElement}
      <ConfirmationModal
        isOpen={open}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
        message={{
          variant,
          title,
          body,
          body2,
          body3,
          body4,
          isButton: true,
          cancelButtonText: cancelText,
          confirmButtonText: confirmText,
        }}
      />
    </>
  );
};

export default ConfirmModalTrigger;
