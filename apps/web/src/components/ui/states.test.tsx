import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState, ErrorState, InlineAlert } from "./states";
import { Stars } from "./stars";

describe("state components", () => {
  it("renders an empty state with action", () => {
    render(<EmptyState icon={Inbox} title="No reviews yet" description="Connect Google to sync reviews." action={<button>Connect</button>} />);
    expect(screen.getByRole("heading", { name: "No reviews yet" })).toBeInTheDocument();
    expect(screen.getByText("Connect Google to sync reviews.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });

  it("renders an error state that retries", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Network down" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("marks danger alerts for assistive tech", () => {
    render(<InlineAlert variant="danger" title="Payment failed">Update your card</InlineAlert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Payment failed");
  });

  it("labels star ratings", () => {
    render(<Stars rating={4} />);
    expect(screen.getByRole("img", { name: "4 out of 5 stars" })).toBeInTheDocument();
  });
});
