import { Modal } from "@mui/material";
import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

const resolveVariant = (msg, isLoading) => {
  if (msg.variant) return msg.variant;
  if (isLoading) return "loading";

  const hasCancel = Boolean(msg.cancelButtonText);
  const confirmText = String(msg.confirmButtonText || "");
  const combined = [msg.title, msg.body, msg.body2, msg.body3]
    .filter(Boolean)
    .join(" ");

  if (
    (hasCancel && /삭제|취소|초기화|제거|파기/.test(confirmText)) ||
    (hasCancel && /삭제하시겠습니까|취소하시겠습니까|초기화하시겠습니까/.test(combined))
  ) {
    return "danger";
  }

  if (
    /오류|실패|에러|문제가 발생|불러오지 못|로드하지 못|불러오는데 문제|확인할 수 없습니다/.test(
      combined
    )
  ) {
    return "error";
  }

  if (
    /선택해주세요|선택해 주세요|입력해주세요|입력해 주세요|없습니다|확인 필요|중복|불가능|먼저 /.test(
      combined
    )
  ) {
    return "warning";
  }

  if (
    /저장되었습니다|완료되었습니다|완료|추가했습니다|성공적으로|복원되었습니다|삭제되었습니다|초기화\(클리어\)되었습니다|생성되었습니다/.test(
      combined
    )
  ) {
    return "success";
  }

  return "info";
};

const resolveDefaultTitle = (msg, variant) => {
  if (msg.title) return msg.title;
  const combined = [msg.body, msg.body2].filter(Boolean).join(" ");

  switch (variant) {
    case "loading":
      return "처리 중";
    case "danger":
      if (/취소/.test(combined)) return "취소 확인";
      if (/초기화/.test(combined)) return "초기화 확인";
      return "삭제 확인";
    case "error":
      return "오류 안내";
    case "warning":
      return "확인 필요";
    case "success":
      return "처리 완료";
    case "info":
    default:
      return msg.cancelButtonText ? "작업 확인" : "안내";
  }
};

const VARIANT_ICON_CONFIG = {
  loading: {
    boxClass: "bg-[#eff6ff] border-[#2563eb]/15 text-[#2563eb]",
    renderIcon: () => (
      <Loader2 size={18} strokeWidth={1.75} className="animate-spin" />
    ),
  },
  danger: {
    boxClass: "bg-[#fef2f2] border-[#dc2626]/15 text-[#dc2626]",
    renderIcon: (combined) =>
      /삭제/.test(combined) ? (
        <Trash2 size={18} strokeWidth={1.75} />
      ) : (
        <AlertTriangle size={18} strokeWidth={1.75} />
      ),
  },
  error: {
    boxClass: "bg-[#fef2f2] border-[#dc2626]/15 text-[#dc2626]",
    renderIcon: () => <AlertCircle size={18} strokeWidth={1.75} />,
  },
  warning: {
    boxClass: "bg-[#fffbeb] border-[#d97706]/20 text-[#b45309]",
    renderIcon: () => <AlertTriangle size={18} strokeWidth={1.75} />,
  },
  success: {
    boxClass: "bg-[#f0fdf4] border-[#16a34a]/15 text-[#16a34a]",
    renderIcon: () => <CheckCircle2 size={18} strokeWidth={1.75} />,
  },
  info: {
    boxClass: "bg-[#eff6ff] border-[#2563eb]/15 text-[#2563eb]",
    renderIcon: () => <Info size={18} strokeWidth={1.75} />,
  },
};

const ConfirmationModal = ({ isOpen, onConfirm, onCancel, message = {} }) => {
  const normalized =
    typeof message === "string"
      ? { body: message, isButton: true, confirmButtonText: "확인" }
      : message || {};

  const isLoading = normalized.isButton === false;
  const variant = resolveVariant(normalized, isLoading);
  const titleText = resolveDefaultTitle(normalized, variant);
  const combinedText = [normalized.title, normalized.body]
    .filter(Boolean)
    .join(" ");
  const iconConfig =
    VARIANT_ICON_CONFIG[variant] || VARIANT_ICON_CONFIG.info;

  const showButtons = !isLoading;
  const confirmLabel = normalized.confirmButtonText || "확인";
  const hasCancelButton = Boolean(normalized.cancelButtonText);

  const handleConfirmClick = () => {
    if (onConfirm) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  };

  const handleCancelClick = () => {
    if (isLoading) return;
    if (onCancel) {
      onCancel();
    } else if (onConfirm) {
      onConfirm();
    }
  };

  const handleKeyDown = (event) => {
    if (isLoading) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      handleCancelClick();
    } else if (event.key === "Enter" && !hasCancelButton) {
      event.preventDefault();
      handleConfirmClick();
    }
  };

  return (
    <Modal
      open={Boolean(isOpen)}
      onClose={(_, reason) => {
        if (
          isLoading &&
          (reason === "backdropClick" || reason === "escapeKeyDown")
        ) {
          return;
        }
        handleCancelClick();
      }}
      slotProps={{
        backdrop: {
          style: {
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
          },
        },
      }}
    >
      <div
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-[420px] max-w-[calc(100vw-32px)] bg-white rounded-[12px] border border-[#171717]/[0.10] shadow-[0_16px_40px_rgba(0,0,0,0.14)] overflow-hidden absolute top-1/2 left-1/2 focus:outline-none"
        style={{
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="p-5 sm:p-6 flex items-start gap-3.5">
          <div
            className={`w-9 h-9 rounded-[8px] border flex items-center justify-center shrink-0 ${iconConfig.boxClass}`}
          >
            {iconConfig.renderIcon(combinedText)}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="text-[15px] leading-5 font-semibold text-[#171717] m-0 break-keep">
              {titleText}
            </h2>

            {normalized.body && (
              <p className="text-[14px] leading-[21px] text-[#404040] mt-1.5 mb-0 break-keep">
                {normalized.body}
              </p>
            )}

            {normalized.body2 && (
              <p className="text-[13px] leading-5 text-[#525252] mt-1 mb-0 break-keep">
                {normalized.body2}
              </p>
            )}

            {normalized.body3 && (
              <p className="text-[13px] leading-5 text-[#525252] mt-1 mb-0 break-keep">
                {normalized.body3}
              </p>
            )}

            {isLoading && !normalized.body2 && (
              <p className="text-[12px] leading-4 text-[#737373] mt-1.5 mb-0">
                잠시만 기다려 주세요
              </p>
            )}

            {normalized.body4 && (
              <div className="mt-3 px-3 py-2 rounded-[8px] bg-[#fafafa] border border-[#171717]/[0.06] text-[12px] leading-[18px] font-mono text-[#737373] break-all">
                {normalized.body4}
              </div>
            )}
          </div>

          {!isLoading && (
            <button
              type="button"
              onClick={handleCancelClick}
              aria-label="닫기"
              className="w-7 h-7 -mt-0.5 -mr-1 rounded-[6px] inline-flex items-center justify-center text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5] transition-colors shrink-0 cursor-pointer"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {showButtons && (
          <div className="px-5 py-3.5 bg-[#fafafa] border-t border-[#171717]/[0.06] flex items-center justify-end gap-2">
            {hasCancelButton && (
              <button
                type="button"
                onClick={handleCancelClick}
                className="min-w-[84px] h-9 px-4 rounded-[8px] bg-white hover:bg-[#f4f4f5] active:scale-[0.99] border border-[#171717]/[0.12] text-[13px] leading-5 font-medium text-[#171717] transition-[background-color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 cursor-pointer"
              >
                {normalized.cancelButtonText}
              </button>
            )}
            <button
              type="button"
              autoFocus={!hasCancelButton}
              onClick={handleConfirmClick}
              className={`min-w-[84px] h-9 px-4 rounded-[8px] active:scale-[0.99] text-[13px] leading-5 font-medium text-white transition-[background-color,transform] duration-150 focus:outline-none cursor-pointer ${
                variant === "danger"
                  ? "bg-[#dc2626] hover:bg-[#b91c1c] focus-visible:ring-2 focus-visible:ring-[#dc2626]/40"
                  : "bg-[#2563eb] hover:bg-[#1d4ed8] focus-visible:ring-2 focus-visible:ring-[#2563eb]/40"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
