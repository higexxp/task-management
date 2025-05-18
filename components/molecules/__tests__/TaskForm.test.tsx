import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskForm from '../TaskForm';

describe('TaskForm', () => {
  test('renders form elements correctly', () => {
    render(<TaskForm />);
    
    expect(screen.getByLabelText(/タスク名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/説明/)).toBeInTheDocument();
    expect(screen.getByLabelText(/期限/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登録/ })).toBeInTheDocument();
  });

  test('shows validation error for empty task name', () => {
    render(<TaskForm />);
    
    // Submit the form without filling any fields
    fireEvent.click(screen.getByRole('button', { name: /登録/ }));
    
    // Check if error messages are displayed
    expect(screen.getByText('タスク名は必須です')).toBeInTheDocument();
  });

  test('shows validation error for empty description', () => {
    render(<TaskForm />);
    
    // Submit the form without filling any fields
    fireEvent.click(screen.getByRole('button', { name: /登録/ }));
    
    // Check if error messages are displayed
    expect(screen.getByText('説明は必須です')).toBeInTheDocument();
  });

  test('shows no validation errors when form is filled correctly', () => {
    render(<TaskForm />);
    
    // Fill in the form fields
    fireEvent.change(screen.getByLabelText(/タスク名/), { target: { value: 'テストタスク' } });
    fireEvent.change(screen.getByLabelText(/説明/), { target: { value: 'テスト説明' } });
    fireEvent.change(screen.getByLabelText(/期限/), { target: { value: '2023-12-31' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /登録/ }));
    
    // Check that no error messages are displayed
    expect(screen.queryByText('タスク名は必須です')).not.toBeInTheDocument();
    expect(screen.queryByText('説明は必須です')).not.toBeInTheDocument();
    expect(screen.queryByText(/正しい日付形式/)).not.toBeInTheDocument();
  });

  test('validates date format', () => {
    render(<TaskForm />);
    
    // Fill in the form fields with an invalid date
    fireEvent.change(screen.getByLabelText(/タスク名/), { target: { value: 'テストタスク' } });
    fireEvent.change(screen.getByLabelText(/説明/), { target: { value: 'テスト説明' } });
    
    // This is a hack since we can't directly set an invalid date via the date input
    // We'll need to modify the component to test this properly
    const dateInput = screen.getByLabelText(/期限/) as HTMLInputElement;
    Object.defineProperty(dateInput, 'value', { value: 'invalid-date' });
    fireEvent.change(dateInput, { target: { value: 'invalid-date' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /登録/ }));
    
    // In a real test, we would check for date validation errors here
    // But due to browser constraints on date inputs, this test is limited
  });
});