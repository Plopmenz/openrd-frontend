"use client"

import React from "react"
import dynamic from "next/dynamic"
import type { ReactQuillProps } from "react-quill"

import { Input } from "./input"
import './react-quill.css'
import "react-quill/dist/quill.snow.css"
import "react-quill/dist/quill.bubble.css"

const QuillNoSSRWrapper = dynamic(() => import("react-quill"), {
  ssr: false,
  loading: () => <Input />,
})

export interface RichTextAreaProps extends Omit<ReactQuillProps, "onChange"> {
  value?: string
  onChange?: (value: string) => void
  styleClass?: string
  themeSelected?: string
}

const RichTextArea = React.forwardRef<HTMLDivElement, RichTextAreaProps>(
  ({ value, onChange, styleClass, themeSelected, ...props }, ref) => {
    const modules = {
      toolbar: [
        [{ header: "1" }, { header: "2" }, { font: [] }],
        [{ size: [] }],
        ["bold", "italic", "underline", "strike", "blockquote"],
        [
          { list: "ordered" },
          { list: "bullet" },
          { indent: "-1" },
          { indent: "+1" },
        ],
        ["link", "image", "video"],
        ["clean"],
      ],
      clipboard: {
        // toggle to add extra line breaks when pasting HTML:
        matchVisual: false,
      },
    }
    /*
     * Quill editor formats
     * See https://quilljs.com/docs/formats/
     */
    const formats = [
      "header",
      "font",
      "size",
      "bold",
      "italic",
      "underline",
      "strike",
      "blockquote",
      "list",
      "bullet",
      "indent",
      "link",
      "image",
      "video",
    ]

    return (
      <div ref={ref} className={`text-sm ${styleClass}`}>
        <QuillNoSSRWrapper
          theme={themeSelected ?? "snow"}
          modules={modules}
          formats={formats}
          {...props}
          value={value}
          onChange={(value, delta, source, editor) => onChange?.(value)}
        />
      </div>
    )
  }
)
RichTextArea.displayName = QuillNoSSRWrapper.displayName

export { RichTextArea }
