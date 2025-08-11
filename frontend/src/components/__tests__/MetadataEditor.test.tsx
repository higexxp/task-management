import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MetadataEditor from '../MetadataEditor';
import { IssueMetadata } from '../../utils/metadata';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('MetadataEditor', () => {
  const mockOnChange = jest.fn();
  const defaultMetadata: IssueMetadata = {
    priority: 'medium',
    category: 'bug',
    size: 'small',
    status: 'todo',
    timeSpent: 2.5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all metadata fields', () => {
    renderWithTheme(
      <MetadataEditor metadata={defaultMetadata} onChange={mockOnChange} />
    );

    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Time Spent (hours)')).toBeInTheDocument();
  });

  it('displays current metadata values', () => {
    renderWithTheme(
      <MetadataEditor metadata={defaultMetadata} onChange={mockOnChange} />
    );

    expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();
  });

  it('calls onChange when priority is changed', () => {
    renderWithTheme(
      <MetadataEditor metadata={defaultMetadata} onChange={mockOnChange} />
    );

    const prioritySelect = screen.getByLabelText('Priority');
    fireEvent.mouseDown(prioritySelect);
    
    const highOption = screen.getByText('High');
    fireEvent.click(highOption);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultMetadata,
      priority: 'high',
    });
  });

  it('calls onChange when time spent is changed', () => {
    renderWithTheme(
      <MetadataEditor metadata={defaultMetadata} onChange={mockOnChange} />
    );

    const timeInput = screen.getByLabelText('Time Spent (hours)');
    fireEvent.change(timeInput, { target: { value: '5' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultMetadata,
      timeSpent: 5,
    });
  });

  it('handles empty metadata', () => {
    renderWithTheme(
      <MetadataEditor metadata={{}} onChange={mockOnChange} />
    );

    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });

  it('clears field when None is selected', () => {
    renderWithTheme(
      <MetadataEditor metadata={defaultMetadata} onChange={mockOnChange} />
    );

    const prioritySelect = screen.getByLabelText('Priority');
    fireEvent.mouseDown(prioritySelect);
    
    const noneOption = screen.getByText('None');
    fireEvent.click(noneOption);

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultMetadata,
      priority: undefined,
    });
  });
});