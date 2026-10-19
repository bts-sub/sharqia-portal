import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node, ...props }) => (
    <div className="table-wrap"><table {...props} /></div>
  ),
};

function Markdown({ text }) {
  return (
    <div className="md" dir="auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
