import { Fragment } from "react";

/** Renders the little formatting the model uses: paragraphs and **bold**. Everything else stays plain text. */
export function RichText({ text }: { text: string }) {
  return text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={index} className="whitespace-pre-line">
        {paragraph.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={partIndex} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <Fragment key={partIndex}>{part.replace(/^[*-] /gm, "• ")}</Fragment>
          ),
        )}
      </p>
    ));
}
