import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExecutionMonitor } from './ExecutionMonitor';
import * as useRealtimeExecutionModule from '@/hooks/useRealtimeExecution';

// Mock the useRealtimeExecution hook
vi.mock('@/hooks/useRealtimeExecution');

const mockExecution = {
  id: 'exec-123',
  workflow_id: 'workflow-123',
  status: 'running',
  execution_type: 'test',
  started_at: new Date().toISOString(),
  completed_at: null,
  total_prospects: 10,
  processed_prospects: 5,
  prospects_found: 10,
  emails_generated: 5,
  emails_sent: 0,
  progress_logs: [
    {
      message: '[1/3] 🚀 Test run started - Initializing...',
      timestamp: new Date().toISOString(),
    },
    {
      message: '[2/3] 🔍 Clado: Searching for prospects...',
      timestamp: new Date().toISOString(),
    },
  ],
  error_message: null,
};

describe('ExecutionMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('should show loading spinner when loading', () => {
      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: null,
        loading: true,
      });

      const { container } = render(<ExecutionMonitor executionId="exec-123" />);

      // Check for loading spinner by looking for the animate-spin class
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show loading spinner when execution is null', () => {
      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: null,
        loading: false,
      });

      const { container } = render(<ExecutionMonitor executionId="exec-123" />);

      // Check for loading spinner by looking for the animate-spin class
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Execution display', () => {
    it('should display test run execution correctly', () => {
      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: mockExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('Test Run')).toBeInTheDocument();
      expect(screen.getByText(/Started.*ago/)).toBeInTheDocument();
    });

    it('should display production run execution correctly', () => {
      const productionExecution = {
        ...mockExecution,
        execution_type: 'production',
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: productionExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('Production Run')).toBeInTheDocument();
    });
  });

  describe('Status badges', () => {
    it('should show running badge for running execution', () => {
      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: mockExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('should show completed badge for completed execution', () => {
      const completedExecution = {
        ...mockExecution,
        status: 'completed',
        completed_at: new Date().toISOString(),
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: completedExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should show failed badge for failed execution', () => {
      const failedExecution = {
        ...mockExecution,
        status: 'failed',
        error_message: 'Something went wrong',
        completed_at: new Date().toISOString(),
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: failedExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should show cancelled badge for cancelled execution', () => {
      const cancelledExecution = {
        ...mockExecution,
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: cancelledExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });

  describe('Progress display', () => {
    it('should calculate and display progress correctly', () => {
      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: mockExecution, // 5/10 prospects = 50%
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('5 / 10')).toBeInTheDocument();
      expect(screen.getByText('50% complete')).toBeInTheDocument();
    });

    it('should show 0% when no prospects processed', () => {
      const noProgressExecution = {
        ...mockExecution,
        total_prospects: 0,
        processed_prospects: 0,
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: noProgressExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('0 / 0')).toBeInTheDocument();
      expect(screen.getByText('0% complete')).toBeInTheDocument();
    });

    it('should show 100% when all prospects processed', () => {
      const completeExecution = {
        ...mockExecution,
        total_prospects: 10,
        processed_prospects: 10,
        status: 'completed',
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: completeExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('10 / 10')).toBeInTheDocument();
      expect(screen.getByText('100% complete')).toBeInTheDocument();
    });
  });

  describe('Current step indicator', () => {
    it('should show "Finding Prospects" step for Clado logs', () => {
      const cladoExecution = {
        ...mockExecution,
        progress_logs: [
          {
            message: '[2/3] 🔍 Clado: Searching for prospects...',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: cladoExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('Finding Prospects')).toBeInTheDocument();
    });

    it('should show "Generating Emails" step for OpenAI logs', () => {
      const openaiExecution = {
        ...mockExecution,
        progress_logs: [
          {
            message: '[3/3] 🤖 OpenAI: Generating email 1/5...',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: openaiExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('Generating Emails')).toBeInTheDocument();
    });

    it('should show "Sending Emails" step for send logs', () => {
      const sendingExecution = {
        ...mockExecution,
        progress_logs: [
          {
            message: 'Sending email to prospect...',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: sendingExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('Sending Emails')).toBeInTheDocument();
    });

    it('should not show step indicator when execution is completed', () => {
      const completedExecution = {
        ...mockExecution,
        status: 'completed',
        progress_logs: [
          {
            message: '🎉 Test run complete!',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: completedExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.queryByText('In progress...')).not.toBeInTheDocument();
    });
  });

  describe('Activity logs', () => {
    it('should display all log messages', () => {
      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: mockExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('[1/3] 🚀 Test run started - Initializing...')).toBeInTheDocument();
      expect(screen.getByText('[2/3] 🔍 Clado: Searching for prospects...')).toBeInTheDocument();
    });

    it('should show timestamps for logs', () => {
      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: mockExecution,
        loading: false,
      });

      const { container } = render(<ExecutionMonitor executionId="exec-123" />);

      // Check that timestamps are rendered (they contain colons for time format)
      const timestamps = container.querySelectorAll('.text-xs.text-muted-foreground');
      expect(timestamps.length).toBeGreaterThan(0);
    });

    it('should show "No logs yet" when no logs exist', () => {
      const noLogsExecution = {
        ...mockExecution,
        progress_logs: [],
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: noLogsExecution,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('No logs yet...')).toBeInTheDocument();
    });

    it('should handle null progress_logs gracefully', () => {
      const nullLogsExecution = {
        ...mockExecution,
        progress_logs: null,
      };

      vi.mocked(useRealtimeExecutionModule.useRealtimeExecution).mockReturnValue({
        execution: nullLogsExecution as any,
        loading: false,
      });

      render(<ExecutionMonitor executionId="exec-123" />);

      expect(screen.getByText('No logs yet...')).toBeInTheDocument();
    });
  });
});
