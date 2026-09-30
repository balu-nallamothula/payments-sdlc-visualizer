import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { makeLinkTransformer } from '../lib/githubLinks';

/**
 * Markdown renderer. When `repoCtx` is provided, relative links are rewritten to
 * GitHub URLs (so artifact source-file references don't resolve to localhost).
 */
export function Markdown({ children, repoCtx }) {
  const components = useMemo(() => {
    if (!repoCtx) return undefined;
    const transform = makeLinkTransformer(repoCtx);
    return {
      a: ({ href, children: linkChildren, ...props }) => (
        <a href={transform(href)} target="_blank" rel="noreferrer" {...props}>
          {linkChildren}
        </a>
      ),
    };
  }, [repoCtx]);

  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
