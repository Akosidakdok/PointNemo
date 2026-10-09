import { type Evidence, type QuestionSet } from "../api";

export function SourceEvidence({ evidence, questionSet }: { evidence: Evidence[]; questionSet: QuestionSet }) {
  return <div className="source-evidence-block" aria-label="Supporting source passages">
    {evidence.map((reference, index) => {
      const page = questionSet.extractedPages.find((entry) => entry.pageNumber === reference.pageNumber && entry.chunkId === reference.chunkId);
      return <div key={`${reference.chunkId}-${index}`}>
        <div className="source-evidence-header"><span className="source-badge">SUPPORTING SOURCE PASSAGE</span><span className="source-page-tag">PAGE {reference.pageNumber} · {reference.chunkId}</span></div>
        <blockquote className="source-quote-text">{reference.quote}</blockquote>
        {page && <details><summary>Read full context on page {page.pageNumber}</summary><p style={{ whiteSpace: "pre-wrap" }}>{page.text}</p></details>}
      </div>;
    })}
    {evidence.length === 0 && <p>No supporting passage was returned by the server.</p>}
  </div>;
}
