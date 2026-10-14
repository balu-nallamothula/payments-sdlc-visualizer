import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { makeLinkTransformer } from '../lib/githubLinks';
import { Mermaid } from './Mermaid';

/**
 * Markdown renderer. Renders ```mermaid fenced blocks as diagrams (lazy-loaded),
 * and when `repoCtx` is provided rewrites relative links to GitHub URLs (so
 * artifact source-file references don't resolve to localhost).
 */
export function Markdown({ children, repoCtx }) {
  const components = useMemo(() => {
    const comps = {
      // A fenced code block renders as <pre><code class="language-x">. Intercept
      // mermaid here (not in `code`) so we can replace the whole <pre> with the
      // diagram instead of nesting a <div> inside a <pre>.
      pre({ children: preChildren, ...props }) {
        const child = Array.isArray(preChildren) ? preChildren[0] : preChildren;
        const cls = child?.props?.className || '';
        if (/\blanguage-mermaid\b/.test(cls)) {
          const code = child.props.children;
          const text = (Array.isArray(code) ? code.join('') : String(code ?? '')).replace(/\n$/, '');
          return <Mermaid chart={text} />;
        }
        return <pre {...props}>{preChildren}</pre>;
      },
    };
    if (repoCtx) {
      const transform = makeLinkTransformer(repoCtx);
      comps.a = ({ href, children: linkChildren, ...props }) => (
        <a href={transform(href)} target="_blank" rel="noreferrer" {...props}>
          {linkChildren}
        </a>
      );
    }
    return comps;
  }, [repoCtx]);

  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
