"use client";

import { Button } from "@auction/ui/lax/button";
import { Dialog } from "@auction/ui/lax/dialog";
import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Called when the person dismisses the notice, so the page can forget the failed opening. */
  onDismiss: () => void;
};

type State = { failed: boolean };

/**
 * Catches the bid dialog's code failing to load, so a flaky connection gives an honest answer
 * and a way out, never a blank page or a button that does nothing.
 */
export class BidDialogBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  private dismiss = () => {
    this.setState({ failed: false });
    this.props.onDismiss();
  };

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) this.dismiss();
        }}
        title="Couldn't open bidding"
        description="Reload the page."
        footer={
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      >
        <p className="m-0 text-lax-14 leading-6 text-lax-muted">
          The page could not load bidding. Reloading usually fixes it.
        </p>
      </Dialog>
    );
  }
}
