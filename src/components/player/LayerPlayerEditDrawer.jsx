import React, { useEffect, useMemo, useState } from "react";
import { Checkbox, Drawer, Input, InputNumber, Select } from "antd";
import { AlertCircle, Check, Layers, Pencil } from "lucide-react";
import {
  isGrandPrixEntryLike,
  parseHeightWeightValue,
  resolveOriginalGradeTitle,
} from "../../utils/playerEntryUtils";
import { isSameLayerPlayerEntry } from "../../utils/layerPlayerEditUtils";

const LAYER_META = {
  assign: {
    badge: "1단계 · 초기 배번 레이어",
    collectionLabel: "contest_players_assign",
    title: "선수 정보 직접 수정 (① 초기 배번)",
    notice:
      "초기 배번 문서(contest_players_assign)만 수정합니다. 2단계를 아직 저장하지 않았다면 다음 단계로 자동 승계되며, 이미 2·3단계에 저장된 데이터는 변경되지 않습니다.",
  },
  weighin: {
    badge: "2단계 · 계측 확정 레이어",
    collectionLabel: "contest_players_final.weighInPlayers",
    title: "선수 정보 직접 수정 (② 선수 계측)",
    notice:
      "계측 레이어 데이터를 수정합니다. 1단계 초기 배번 원본은 변경되지 않으며, 3단계에서 이미 별도 수정·저장한 항목을 제외한 나머지 항목만 3단계로 승계됩니다.",
  },
  final: {
    badge: "3단계 · 최종 출전 레이어",
    collectionLabel: "contest_players_final",
    title: "선수 정보 직접 수정 (③ 최종 출전)",
    notice:
      "최종 출전 명단(contest_players_final)의 해당 엔트리만 단독 수정합니다. 1·2단계 기록 및 이미 저장된 다른 레이어 데이터에는 영향을 주지 않습니다.",
  },
  grandprix: {
    badge: "3단계 · 그랑프리 레이어",
    collectionLabel: "contest_players_final (그랑프리)",
    title: "그랑프리 진출 선수 정보 직접 수정",
    notice:
      "그랑프리 출전 엔트리만 단독 수정합니다. 하위 정규 체급 출전 명단이나 1·2단계 기록은 변경되지 않습니다.",
  },
};

const LayerPlayerEditDrawer = ({
  open,
  onClose,
  layer = "final",
  player = null,
  categoriesArray = [],
  gradesArray = [],
  allLayerPlayers = [],
  onSave,
  isSaving = false,
}) => {
  const effectiveLayer = useMemo(() => {
    if (layer === "grandprix") return "grandprix";
    if (player && isGrandPrixEntryLike(player) && layer === "final") {
      return "grandprix";
    }
    return LAYER_META[layer] ? layer : "final";
  }, [layer, player]);

  const meta = LAYER_META[effectiveLayer];
  const isGpMode = effectiveLayer === "grandprix";
  const showBodyMetrics =
    effectiveLayer === "weighin" || effectiveLayer === "final";
  const showNoShowToggle =
    effectiveLayer === "weighin" ||
    effectiveLayer === "final" ||
    effectiveLayer === "grandprix";

  const [formState, setFormState] = useState({
    playerNumber: 1,
    playerIndex: 1,
    playerName: "",
    playerGym: "",
    playerTel: "",
    playerBirth: "",
    contestCategoryId: "",
    contestGradeId: "",
    originalGradeTitle: "",
    height: "",
    weight: "",
    playerNoShow: false,
    isGradeChanged: false,
    playerText: "",
  });

  useEffect(() => {
    if (!open || !player) return;
    const parsedHW = parseHeightWeightValue(player.heightWeight);
    const resolvedH =
      player.playerHeight || player.height || parsedHW.height || "";
    const resolvedW =
      player.playerWeight || player.weight || parsedHW.weight || "";
    const resolvedIdx = isGpMode
      ? Number(player.grandPrixIndex ?? player.playerIndex) || 1
      : Number(player.playerIndex) || Number(player.playerNumber) || 1;

    setFormState({
      playerNumber: Number(player.playerNumber) || 1,
      playerIndex: resolvedIdx,
      playerName: player.playerName || "",
      playerGym: player.playerGym || "",
      playerTel: player.playerTel || "",
      playerBirth: player.playerBirth || "",
      contestCategoryId: player.contestCategoryId || "",
      contestGradeId: player.contestGradeId || "",
      originalGradeTitle: resolveOriginalGradeTitle(player) || "",
      height: resolvedH,
      weight: resolvedW,
      playerNoShow: Boolean(player.playerNoShow),
      isGradeChanged: Boolean(player.isGradeChanged),
      playerText: player.playerText || "",
    });
  }, [open, player, isGpMode]);

  const selectableCategories = useMemo(() => {
    const list = [...(categoriesArray || [])].sort(
      (a, b) =>
        (Number(a?.contestCategoryIndex) || 0) -
        (Number(b?.contestCategoryIndex) || 0)
    );
    if (isGpMode) {
      return list.filter((c) => c?.contestCategorySection === "그랑프리");
    }
    return list.filter((c) => c?.contestCategorySection !== "그랑프리");
  }, [categoriesArray, isGpMode]);

  const filteredGradesForCat = useMemo(() => {
    if (!formState.contestCategoryId) return [];
    return [...(gradesArray || [])]
      .filter((g) => g?.refCategoryId === formState.contestCategoryId)
      .sort(
        (a, b) =>
          (Number(a?.contestGradeIndex) || 0) -
          (Number(b?.contestGradeIndex) || 0)
      );
  }, [gradesArray, formState.contestCategoryId]);

  const conflictingNumberPlayer = useMemo(() => {
    const targetNum = Number(formState.playerNumber);
    if (!player || !Number.isFinite(targetNum) || targetNum <= 0) return null;

    return (
      (allLayerPlayers || []).find((other) => {
        if (!other || isSameLayerPlayerEntry(other, player)) return false;
        if (Number(other.playerNumber) !== targetNum) return false;
        // 동일 선수(다종목 중복 출전)가 같은 배번을 쓰는 경우는 정상 케이스이므로 경고 제외
        if (
          player.playerUid &&
          other.playerUid &&
          player.playerUid === other.playerUid
        ) {
          return false;
        }
        if (
          !player.playerUid &&
          !other.playerUid &&
          String(other.playerName || "").trim() ===
            String(formState.playerName || player.playerName || "").trim()
        ) {
          return false;
        }
        return true;
      }) || null
    );
  }, [allLayerPlayers, formState.playerNumber, formState.playerName, player]);

  const handleCategoryChange = (nextCategoryId) => {
    const matchingGrades = [...(gradesArray || [])]
      .filter((g) => g?.refCategoryId === nextCategoryId)
      .sort(
        (a, b) =>
          (Number(a?.contestGradeIndex) || 0) -
          (Number(b?.contestGradeIndex) || 0)
      );
    const firstGradeId = matchingGrades[0]?.contestGradeId || "";

    setFormState((prev) => ({
      ...prev,
      contestCategoryId: nextCategoryId,
      contestGradeId: firstGradeId,
      isGradeChanged: false,
    }));
  };

  const handleSubmit = () => {
    if (!player || !onSave) return;
    const trimmedName = String(formState.playerName || "").trim();
    if (!trimmedName) return;

    const selectedCat = (categoriesArray || []).find(
      (c) => c?.contestCategoryId === formState.contestCategoryId
    );
    const selectedGrade = (gradesArray || []).find(
      (g) => g?.contestGradeId === formState.contestGradeId
    );

    const payload = {
      playerNumber: Number(formState.playerNumber) || 1,
      playerIndex: Number(formState.playerIndex) || 1,
      ...(isGpMode
        ? { grandPrixIndex: Number(formState.playerIndex) || 1 }
        : {}),
      playerName: trimmedName,
      playerGym: String(formState.playerGym || "").trim(),
      playerTel: String(formState.playerTel || "").trim(),
      playerBirth: String(formState.playerBirth || "").trim(),
      playerText: String(formState.playerText || ""),
      ...(selectedCat
        ? {
            contestCategoryId: selectedCat.contestCategoryId,
            contestCategoryTitle: selectedCat.contestCategoryTitle,
            contestCategorySection: selectedCat.contestCategorySection || "",
          }
        : {}),
      ...(selectedGrade
        ? {
            contestGradeId: selectedGrade.contestGradeId,
            contestGradeTitle: selectedGrade.contestGradeTitle,
          }
        : {}),
      ...(isGpMode
        ? {
            originalGradeTitle: String(formState.originalGradeTitle || "").trim(),
          }
        : {
            isGradeChanged: Boolean(formState.isGradeChanged),
          }),
      ...(showBodyMetrics
        ? {
            height: String(formState.height || "").trim(),
            weight: String(formState.weight || "").trim(),
          }
        : {}),
      ...(showNoShowToggle
        ? {
            playerNoShow: Boolean(formState.playerNoShow),
          }
        : {}),
    };

    onSave(player, payload);
  };

  const isSubmitDisabled =
    isSaving ||
    !String(formState.playerName || "").trim() ||
    !Number(formState.playerNumber) ||
    Number(formState.playerNumber) <= 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={460}
      destroyOnClose
      title={
        <div className="flex items-center gap-2 text-[#171717]">
          <Pencil size={15} strokeWidth={1.7} className="text-[#2563eb]" />
          <span className="font-semibold text-[15px] tracking-tight">
            {meta.title}
          </span>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2 py-1">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#171717]/[0.12] bg-[#ffffff] hover:bg-[#f4f4f5] text-[#525252] text-xs font-medium transition-colors duration-150 cursor-pointer disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isSubmitDisabled}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium border-0 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={14} strokeWidth={1.8} />
            <span>{isSaving ? "저장 중..." : "현재 레이어에 저장"}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 레이어 DB 격리 안내 배너 */}
        <div className="rounded-[10px] border border-[#2563eb]/20 bg-[#2563eb]/[0.04] p-3.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1d4ed8]">
              <Layers size={13} strokeWidth={1.7} />
              <span>{meta.badge}</span>
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-[4px] bg-[#ffffff] border border-[#2563eb]/20 text-[#2563eb]">
              {meta.collectionLabel}
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-[#525252] m-0">
            {meta.notice}
          </p>
        </div>

        {/* 배번 & 무대 순번 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1.5">
              선수번호 (배번) <span className="text-[#dc2626]">*</span>
            </label>
            <InputNumber
              min={1}
              value={formState.playerNumber}
              onChange={(v) =>
                setFormState((prev) => ({ ...prev, playerNumber: v ?? 1 }))
              }
              className="w-full font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1.5">
              {isGpMode ? "그랑프리 무대 순번" : "무대 표시 순번"}
            </label>
            <InputNumber
              min={1}
              value={formState.playerIndex}
              onChange={(v) =>
                setFormState((prev) => ({ ...prev, playerIndex: v ?? 1 }))
              }
              className="w-full font-mono tabular-nums"
            />
          </div>
        </div>

        {conflictingNumberPlayer && (
          <div className="rounded-[8px] border border-[#b45309]/25 bg-[#b45309]/[0.06] px-3 py-2 flex items-start gap-2 text-xs text-[#b45309]">
            <AlertCircle size={14} strokeWidth={1.7} className="mt-0.5 shrink-0" />
            <span>
              현재 레이어에서 <strong>#{formState.playerNumber}번</strong>은{" "}
              <strong>{conflictingNumberPlayer.playerName}</strong> (
              {conflictingNumberPlayer.contestCategoryTitle || "-"}{" "}
              {conflictingNumberPlayer.contestGradeTitle || ""}) 선수도 사용
              중입니다. (다종목 동일인 배번이 아니라면 번호를 확인해 주세요.)
            </span>
          </div>
        )}

        {/* 이름 & 소속 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1.5">
              선수 이름 <span className="text-[#dc2626]">*</span>
            </label>
            <Input
              value={formState.playerName}
              placeholder="선수 성명"
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  playerName: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1.5">
              소속 (체육관 · 팀)
            </label>
            <Input
              value={formState.playerGym}
              placeholder="무소속 / 개인"
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  playerGym: e.target.value,
                }))
              }
            />
          </div>
        </div>

        {/* 종목 & 체급 선택 */}
        {selectableCategories.length > 0 && (
          <div className="rounded-[8px] border border-[#171717]/[0.08] bg-[#fafafa] p-3.5 space-y-3">
            <div className="text-xs font-semibold text-[#171717]">
              {isGpMode ? "그랑프리 부문 · 우승 원체급 정보" : "출전 종목 · 체급 배정"}
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-[#737373] mb-1">
                  종목
                </label>
                <Select
                  value={formState.contestCategoryId || undefined}
                  onChange={handleCategoryChange}
                  disabled={isGpMode}
                  className="w-full"
                  options={selectableCategories.map((cat) => ({
                    value: cat.contestCategoryId,
                    label: `${
                      cat.contestCategorySection
                        ? `[${cat.contestCategorySection}] `
                        : ""
                    }${cat.contestCategoryTitle}`,
                  }))}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#737373] mb-1">
                  체급
                </label>
                <Select
                  value={formState.contestGradeId || undefined}
                  onChange={(nextGradeId) =>
                    setFormState((prev) => ({
                      ...prev,
                      contestGradeId: nextGradeId,
                    }))
                  }
                  disabled={isGpMode && filteredGradesForCat.length <= 1}
                  className="w-full"
                  options={filteredGradesForCat.map((grd) => ({
                    value: grd.contestGradeId,
                    label: grd.contestGradeTitle,
                  }))}
                />
              </div>

              {isGpMode ? (
                <div>
                  <label className="block text-[11px] font-medium text-[#737373] mb-1">
                    하위 우승 원체급 표기 (전광판·출력 표시용)
                  </label>
                  <Input
                    value={formState.originalGradeTitle}
                    placeholder="예: -70kg"
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        originalGradeTitle: e.target.value,
                      }))
                    }
                  />
                </div>
              ) : (
                effectiveLayer !== "assign" && (
                  <Checkbox
                    checked={formState.isGradeChanged}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        isGradeChanged: e.target.checked,
                      }))
                    }
                  >
                    <span className="text-xs text-[#525252]">
                      월체(체급 변경) 표시 유지
                    </span>
                  </Checkbox>
                )
              )}
            </div>
          </div>
        )}

        {/* 신장 · 체중 (2단계, 3단계 일반) */}
        {showBodyMetrics && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1.5">
                신장 (cm)
              </label>
              <Input
                value={formState.height}
                placeholder="예: 175.4"
                suffix={<span className="text-xs text-[#737373]">cm</span>}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, height: e.target.value }))
                }
                className="font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#525252] mb-1.5">
                체중 (kg)
              </label>
              <Input
                value={formState.weight}
                placeholder="예: 74.2"
                suffix={<span className="text-xs text-[#737373]">kg</span>}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, weight: e.target.value }))
                }
                className="font-mono tabular-nums"
              />
            </div>
          </div>
        )}

        {/* 연락처 & 생년월일 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1.5">
              연락처
            </label>
            <Input
              value={formState.playerTel}
              placeholder="010-0000-0000"
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, playerTel: e.target.value }))
              }
              className="font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1.5">
              생년월일
            </label>
            <Input
              value={formState.playerBirth}
              placeholder="YYYY-MM-DD"
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  playerBirth: e.target.value,
                }))
              }
              className="font-mono tabular-nums"
            />
          </div>
        </div>

        {/* 비고 / 메모 */}
        <div>
          <label className="block text-xs font-medium text-[#525252] mb-1.5">
            비고 / 현장 메모
          </label>
          <Input.TextArea
            rows={2}
            value={formState.playerText}
            placeholder="현장 참고 메모"
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, playerText: e.target.value }))
            }
          />
        </div>

        {/* 불참 여부 (2·3단계) */}
        {showNoShowToggle && (
          <div className="rounded-[8px] border border-[#171717]/[0.08] bg-[#fafafa] px-3.5 py-2.5">
            <Checkbox
              checked={formState.playerNoShow}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  playerNoShow: e.target.checked,
                }))
              }
            >
              <span className="text-xs font-medium text-[#dc2626]">
                불참(결시) 처리 — 무대 채점 및 호명 대상에서 제외
              </span>
            </Checkbox>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default LayerPlayerEditDrawer;
