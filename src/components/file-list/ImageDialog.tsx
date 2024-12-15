import { Button, Dialog } from "@radix-ui/themes";
import { useImageDialogContext } from "./imageDialogContext";
import { useFileListFocusContext } from "./fileListFocusContext";
import React from "react";
import { X } from "lucide-react";
import { getBasename } from "../../common/functions";
import { convertFileSrc } from "@tauri-apps/api/tauri";

export function ImageDialog() {
  const { open, setOpen } = useImageDialogContext();
  const { file } = useFileListFocusContext();
  const [imgRef, setImgRef] = React.useState<HTMLImageElement | null>(null);

  React.useEffect(() => {
    if (file !== null && imgRef) {
      imgRef.src = convertFileSrc(file.path);
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
              <Dialog.Title className="text-xl">
                {getBasename(file.path)}
              </Dialog.Title>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                <X />
              </Button>
            </div>
            <div className="grid place-items-center h-[90%]">
              <img
                ref={(imgRef) => setImgRef(imgRef)}
                style={{
                  maxHeight: "90vh",
                  objectFit: "contain",
                }}
              />
            </div>
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
