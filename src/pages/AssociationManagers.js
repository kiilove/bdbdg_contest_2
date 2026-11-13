import React, { useEffect, useState } from "react";
import {
  Table,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
} from "antd";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  useFirestoreQuery,
  useFirestoreAddData,
  useFirestoreUpdateData,
  useFirestoreDeleteData,
} from "../hooks/useFirestores";
import bcrypt from "bcryptjs";

const { Option } = Select;

const ROLE_LABELS = {
  admin: "최고 관리자",
  subAdmin: "보조 관리자",
  orgManager: "협회 관리자",
};

const AssociationManagerPage = () => {
  const query = useFirestoreQuery();
  const addUser = useFirestoreAddData("association_managers");
  const updateUser = useFirestoreUpdateData("association_managers");
  const deleteUser = useFirestoreDeleteData("association_managers");

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const users = await query.getDocuments("association_managers");
      setData(users || []);
    } catch (err) {
      console.error(err);
      message.error("사용자 데이터를 불러오지 못했습니다.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddOrUpdate = async (values) => {
    try {
      setLoading(true);
      const { userID, userPass, userGroup, userContext } = values;
      let passwordHash = editingUser?.passwordHash || "";

      if (userPass && userPass.trim() !== "") {
        const salt = bcrypt.genSaltSync(10);
        passwordHash = bcrypt.hashSync(userPass, salt);
      }

      const payload = {
        userID,
        passwordHash,
        userGroup,
        userContext,
        createdAt: editingUser?.createdAt || new Date(),
      };

      if (editingUser) {
        await updateUser.updateData(editingUser.id, payload);
        message.success("사용자 정보를 수정했습니다.");
      } else {
        await addUser.addData(payload);
        message.success("새 사용자를 추가했습니다.");
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      message.error("저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteUser.deleteData(id);
      message.success("사용자를 삭제했습니다.");
      fetchUsers();
    } catch (err) {
      console.error(err);
      message.error("삭제 중 오류가 발생했습니다.");
    }
  };

  const columns = [
    {
      title: "아이디",
      dataIndex: "userID",
      key: "userID",
      render: (val) => (
        <span className="font-mono text-[13px] font-medium text-[#171717]">
          {val}
        </span>
      ),
    },
    {
      title: "협회명",
      dataIndex: "userContext",
      key: "userContext",
      render: (val) => <span className="text-[#171717]">{val || "-"}</span>,
    },
    {
      title: "권한",
      dataIndex: "userGroup",
      key: "userGroup",
      render: (val) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#f4f4f5] border border-[#171717]/[0.08] text-[12px] font-medium text-[#525252]">
          {ROLE_LABELS[val] || val || "-"}
        </span>
      ),
    },
    {
      title: "생성일",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (val) => (
        <span className="font-mono text-[12px] tabular-nums text-[#737373]">
          {val?.seconds
            ? new Date(val.seconds * 1000).toLocaleDateString("ko-KR")
            : "-"}
        </span>
      ),
    },
    {
      title: "관리",
      key: "action",
      width: 150,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingUser(record);
              form.setFieldsValue({
                userID: record.userID,
                userContext: record.userContext,
                userGroup: record.userGroup,
                userPass: "",
              });
              setIsModalOpen(true);
            }}
            className="h-8 px-2.5 rounded-[6px] bg-white hover:bg-[#f4f4f5] border border-[#171717]/[0.12] text-[#171717] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150"
          >
            <Pencil size={13} strokeWidth={1.5} className="text-[#525252]" />
            <span>수정</span>
          </button>
          <Popconfirm
            title="이 계정을 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <button
              type="button"
              className="h-8 px-2.5 rounded-[6px] bg-white hover:bg-[#dc2626]/[0.08] border border-[#dc2626]/25 text-[#dc2626] text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150"
            >
              <Trash2 size={13} strokeWidth={1.5} />
              <span>삭제</span>
            </button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-[1440px] mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-[22px] sm:text-[24px] font-medium text-[#171717] tracking-tight leading-tight">
              협회 관리자 계정 관리
            </h1>
            <p className="text-[13px] text-[#737373] mt-1">
              대회 운영 시스템에 접속하는 협회별 관리자 계정과 권한 등급을 관리합니다
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                form.resetFields();
                setIsModalOpen(true);
              }}
              className="h-9 px-4 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[13px] font-medium inline-flex items-center gap-2 transition-colors duration-150"
            >
              <Plus size={16} strokeWidth={1.5} />
              <span>새 계정 추가</span>
            </button>
          </div>
        </header>

        <section className="bg-white rounded-[12px] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 sm:p-6">
          <Table
            dataSource={data}
            columns={columns}
            loading={loading}
            rowKey="id"
          />
        </section>

        <Modal
          title={editingUser ? "계정 수정" : "새 계정 추가"}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          onOk={() => form.submit()}
          okText="저장"
          cancelText="취소"
        >
          <Form form={form} layout="vertical" onFinish={handleAddOrUpdate}>
            <Form.Item
              name="userID"
              label="아이디"
              rules={[{ required: true, message: "아이디를 입력해주세요" }]}
            >
              <Input placeholder="접속 아이디 입력" />
            </Form.Item>
            <Form.Item
              name="userPass"
              label="비밀번호"
              tooltip="수정 시 비워두면 기존 비밀번호를 유지합니다"
            >
              <Input.Password placeholder="비밀번호 입력" />
            </Form.Item>
            <Form.Item
              name="userGroup"
              label="권한"
              rules={[{ required: true, message: "권한을 선택해주세요" }]}
            >
              <Select placeholder="권한 등급 선택">
                <Option value="admin">최고 관리자</Option>
                <Option value="subAdmin">보조 관리자</Option>
                <Option value="orgManager">협회 관리자</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="userContext"
              label="협회명"
              rules={[{ required: true, message: "협회명을 입력해주세요" }]}
            >
              <Input placeholder="소속 협회명 입력" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default AssociationManagerPage;
