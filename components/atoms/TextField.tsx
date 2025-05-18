import React from "react";

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  name?: string;
};

const TextField: React.FC<TextFieldProps> = ({ label, value, onChange, type = "text", required = false, placeholder = "", name }) => (
  <div className="mb-4">
    <label className="block mb-1 font-medium" htmlFor={name}>{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
    />
  </div>
);

export default TextField; 