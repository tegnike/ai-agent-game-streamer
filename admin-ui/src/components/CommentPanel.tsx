import { useState } from "react";
import { useStreamStore } from "../store/stream-store";
import { CollapsiblePanel } from "./CollapsiblePanel";
import type { AdminCommand } from "../types";

interface Props {
  sendCommand: (cmd: AdminCommand) => void;
}

export function CommentPanel({ sendCommand }: Props) {
  const comments = useStreamStore((s) => s.comments);
  const [showAdd, setShowAdd] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [text, setText] = useState("");

  const handleQueue = (commentId: string) => {
    sendCommand({ type: "comment:queue", commentId });
  };

  const handleDismiss = (commentId: string) => {
    sendCommand({ type: "comment:dismiss", commentId });
  };

  const handleAddComment = async () => {
    if (!authorName.trim() || !text.trim()) return;
    try {
      await fetch("/api/comments/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          text: text.trim(),
          platform: "manual",
        }),
      });
      setAuthorName("");
      setText("");
      setShowAdd(false);
    } catch {
      // Ignore
    }
  };

  return (
    <CollapsiblePanel title="Viewer Comments" className="comment-panel">
      <div className="comment-list">
        {comments.length === 0 && (
          <div className="comment-empty">No comments yet</div>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className={`comment comment-${comment.status}`}>
            <div className="comment-header">
              <span className="comment-author">{comment.authorName}</span>
              <span className="comment-platform">{comment.platform}</span>
              {comment.status !== "received" && (
                <span className={`comment-status-badge status-${comment.status}`}>
                  {comment.status}
                </span>
              )}
            </div>
            <div className="comment-text">{comment.text}</div>
            {comment.status === "received" && (
              <div className="comment-actions">
                <button
                  className="btn btn-sm btn-queue"
                  onClick={() => handleQueue(comment.id)}
                >
                  Queue
                </button>
                <button
                  className="btn btn-sm btn-dismiss"
                  onClick={() => handleDismiss(comment.id)}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="add-comment-form">
          <input
            type="text"
            placeholder="Author name"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Comment text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
          />
          <div className="form-actions">
            <button className="btn btn-sm" onClick={handleAddComment}>
              Add
            </button>
            <button className="btn btn-sm" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-add-comment" onClick={() => setShowAdd(true)}>
          + Add Comment
        </button>
      )}
    </CollapsiblePanel>
  );
}
