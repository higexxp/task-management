import React from "react";
import TaskCreateSection from "@/components/organisms/TaskCreateSection";

const TaskCreatePage = () => {
  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">タスク登録</h1>
      <TaskCreateSection />
    </div>
  );
};

export default TaskCreatePage; 