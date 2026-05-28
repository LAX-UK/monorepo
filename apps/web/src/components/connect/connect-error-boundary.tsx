"use client";

import { Button } from "@auction/ui/components/button";
import type { ReactNode } from "react";
import { Component, type ErrorInfo } from "react";

type Props = {
  children: ReactNode;
  resetKey?: string;
  onReload?: () => void;
};

type State = {
  hasError: boolean;
};

/** Catches Stripe Connect embedded component render failures without crashing the page. */
export class ConnectErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidUpdate(prevProps: Props): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Connect embedded component error", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="space-y-3">
          <p className="font-body text-sm text-error" role="alert">
            Payout setup could not load. Refresh the page or use Refresh status. If this persists,
            contact support@lax.bid.
          </p>
          {this.props.onReload ? (
            <Button type="button" variant="secondary" size="sm" onClick={this.props.onReload}>
              Reload payout setup
            </Button>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}
