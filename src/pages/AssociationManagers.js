// pages/AssociationManagerPage.js
import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
} from "antd";
import {
  useFirestoreQuery,
  useFirestoreAddData,
  useFirestoreUpdateData,
  useFirestoreDeleteData,
} from "../hooks/useFirestores";
import bcrypt from "bcryptjs";

const { Option } = Select;

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
    { title: "아이디", dataIndex: "userID", key: "userID" },
    { title: "협회명", dataIndex: "userContext", key: "userContext" },
    { title: "권한", dataIndex: "userGroup", key: "userGroup" },
    {
      title: "생성일",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (val) =>
        val?.seconds ? new Date(val.seconds * 1000).toLocaleDateString() : "-",
    },
    {
      title: "관리",
      key: "action",
      render: (_, record) => (
        <div className="flex gap-2">
          <Button
            size="small"
            type="primary"
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
          >
            수정
          </Button>
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Button size="small" danger>
              삭제
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="p-5 bg-white rounded-lg shadow-md">
      <div className="flex justify-between mb-3">
        <h1 className="text-xl font-bold">협회 관리자 계정 관리</h1>
        <Button
          type="primary"
          onClick={() => {
            setEditingUser(null);
            form.resetFields();
            setIsModalOpen(true);
          }}
        >
          새 계정 추가
        </Button>
      </div>
      <Table
        dataSource={data}
        columns={columns}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title={editingUser ? "계정 수정" : "새 계정 추가"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        okText="저장"
      >
        <Form form={form} layout="vertical" onFinish={handleAddOrUpdate}>
          <Form.Item
            name="userID"
            label="아이디"
            rules={[{ required: true, message: "아이디를 입력해주세요." }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="userPass"
            label="비밀번호"
            tooltip="수정 시 비워두면 기존 비밀번호를 유지합니다."
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="userGroup"
            label="권한"
            rules={[{ required: true, message: "권한을 선택해주세요." }]}
          >
            <Select>
              <Option value="admin">최고 관리자</Option>
              <Option value="subAdmin">보조 관리자</Option>
              <Option value="orgManager">협회 관리자</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="userContext"
            label="협회명"
            rules={[{ required: true, message: "협회명을 입력해주세요." }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AssociationManagerPage;
