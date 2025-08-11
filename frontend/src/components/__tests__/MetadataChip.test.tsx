import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MetadataChip from '../MetadataChip';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('MetadataChip', () => {
  it('renders priority chip correctly', () => {
    renderWithTheme(<MetadataChip type="priority" value="high" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders category chip correctly', () => {
    renderWithTheme(<MetadataChip type="category" value="bug" />);
    expect(screen.getByText('Bug')).toBeInTheDocument();
  });

  it('renders size chip correctly', () => {
    renderWithTheme(<MetadataChip type="size" value="medium" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders status chip correctly', () => {
    renderWithTheme(<MetadataChip type="status" value="in-progress" />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('handles different variants', () => {
    renderWithTheme(
      <MetadataChip type="priority" value="high" variant="outlined" />
    );
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('handles different sizes', () => {
    renderWithTheme(
      <MetadataChip type="priority" value="high" size="medium" />
    );
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});