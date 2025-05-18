"use client";
import React, { useState } from "react";
import TextField from "@/components/atoms/TextField";
import Button from "@/components/atoms/Button";

const TaskForm: React.FC = () => {
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // バリデーション・送信処理は後続で追加
    alert("送信処理は後続で実装します");
  };

  return (
    <form onSubmit={handleSubmit}>
      <TextField
        label="タスク名"
        value={taskName}
        onChange={e => setTaskName(e.target.value)}
        required
        name="taskName"
        placeholder="例: 買い物リスト作成"
      />
      <TextField
        label="説明"
        value={description}
        onChange={e => setDescription(e.target.value)}
        name="description"
        placeholder="タスクの詳細を入力"
      />
      <TextField
        label="期限"
        value={dueDate}
        onChange={e => setDueDate(e.target.value)}
        type="date"
        name="dueDate"
      />
      <div className="mt-6">
        <Button type="submit">登録</Button>
      </div>
    </form>
  );
};

export default TaskForm; 