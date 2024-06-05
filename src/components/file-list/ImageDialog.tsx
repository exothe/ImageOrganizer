import { Button, Dialog, Spinner } from "@radix-ui/themes";
import { useImageDialogContext } from "./imageDialogContext";
import { useFileListFocusContext } from "./fileListFocusContext";
import React from "react";
import { invoke } from "@tauri-apps/api";
import { X } from "lucide-react";
import { getBasename } from "../../common/functions";

export function ImageDialog() {
  const { open, setOpen } = useImageDialogContext();
  const { file } = useFileListFocusContext();
  const [imgRef, setImgRef] = React.useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);

  const [fileContent, setFileContent] = React.useState<null | Blob>(null);

  React.useEffect(() => {
    if (imgRef && fileContent) {
      imgRef.src = URL.createObjectURL(fileContent);
    }
  }, [fileContent, imgRef]);

  React.useEffect(() => {
    async function loadContent() {
      setLoading(true);
      const content: number[] = await invoke("load_file_content", {
        path: file,
      });
      setFileContent(
        new Blob([new Uint8Array(content)], { type: "octet/stream" }),
      );
      setLoading(false);
    }

    if (file !== null) {
      loadContent();
    }
  }, [file]);

  return (
    <Dialog.Root open={open && file !== null}>
      <Dialog.Content
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          right: "1rem",
          bottom: "1rem",
          maxWidth: "95%",
          maxHeight: "100%",
          borderRadius: 0,
        }}
      >
        {file !== null && (
          <>
            <div className="flex justify-between pb-4">
              <span></span>
              <h1 className="text-xl">{getBasename(file)}</h1>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                <X />
              </Button>
            </div>
            <div className="grid place-items-center h-[90%]">
              {loading ? (
                <Spinner />
              ) : (
                <img
                  ref={(imgRef) => setImgRef(imgRef)}
                  style={{
                    maxHeight: "90vh",
                    objectFit: "contain",
                  }}
                />
              )}
            </div>
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
