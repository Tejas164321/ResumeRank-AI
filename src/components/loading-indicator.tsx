
"use client";

import { BrainCircuit } from "lucide-react";

/**
 * Props for the LoadingIndicator component.
 */
interface LoadingIndicatorProps {
  // The stage of processing to display a relevant message.
  stage: "roles" | "screening" | "general";
}

/**
 * A component to display a themed loading animation and message for long-running AI processes.
 * It shows different messages based on the `stage` prop.
 * @param {LoadingIndicatorProps} props - The component props.
 */
export function LoadingIndicator({ stage }: LoadingIndicatorProps) {
  let message = "Processing...";
  if (stage === "roles") {
    message = "AI is extracting job roles...";
  } else if (stage === "screening") {
    message = "AI is analyzing resumes and roles...";
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-10 text-center">
      {/* The animated icon */}
      <div className="relative w-16 h-16">
        {/* A pulsing background glow */}
        <div className="absolute inset-0 bg-primary rounded-full animate-pulse opacity-30"></div>
        {/* A spinning brain icon */}
        <BrainCircuit className="absolute inset-0 w-full h-full text-primary animate-spin" />
      </div>

      {/* The loading messages */}
      <div>
        <p className="text-xl font-semibold text-primary">
          {message}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This may take a few moments. Please be patient.
        </p>
      </div>
    </div>
  );
}
