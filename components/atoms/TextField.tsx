import React from "react";

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  name?: string;
  error?: string;
};

const TextField: React.FC<TextFieldProps> = ({ 
  label, 
  value, 
  onChange, 
  type = "text", 
  required = false, 
  placeholder = "", 
  name,
  error
}) => (
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
      className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 ${error ? 'border-red-500' : ''}`}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

export default TextField; 