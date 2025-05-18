"use client";
import React, { useState } from "react";
import TextField from "@/components/atoms/TextField";
import Button from "@/components/atoms/Button";

interface FormErrors {
  taskName?: string;
  description?: string;
  dueDate?: string;
}

const TaskForm: React.FC = () => {
  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    // タスク名の必須入力チェック
    if (!taskName.trim()) {
      newErrors.taskName = "タスク名は必須です";
      isValid = false;
    }

    // 説明の必須入力チェック
    if (!description.trim()) {
      newErrors.description = "説明は必須です";
      isValid = false;
    }

    // 期限の日付フォーマットチェック
    if (dueDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dueDate)) {
        newErrors.dueDate = "正しい日付形式で入力してください (YYYY-MM-DD)";
        isValid = false;
      } else {
        const dateObj = new Date(dueDate);
        if (isNaN(dateObj.getTime())) {
          newErrors.dueDate = "有効な日付を入力してください";
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      // バリデーション成功時の処理
      alert("送信処理は後続で実装します");
    }
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
        error={errors.taskName}
      />
      <TextField
        label="説明"
        value={description}
        onChange={e => setDescription(e.target.value)}
        required
        name="description"
        placeholder="タスクの詳細を入力"
        error={errors.description}
      />
      <TextField
        label="期限"
        value={dueDate}
        onChange={e => setDueDate(e.target.value)}
        type="date"
        name="dueDate"
        error={errors.dueDate}
      />
      <div className="mt-6">
        <Button type="submit">登録</Button>
      </div>
    </form>
  );
};

export default TaskForm;