import { Button } from "@radix-ui/themes";
import { Image } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useImageDialogContext } from "./imageDialogContext";
import { getBasename } from "../../common/functions";

export function FileListRow({
  file,
  selected,
  onClick,
}: {
  file: string;
  selected: boolean;
  onClick: () => void;
}) {
  const { setOpen } = useImageDialogContext();

  return (
    <div
      className={twMerge(
        "bg-gray-100 hover:bg-gray-200 flex gap-2 justify-between",
        selected && "bg-blue-400 hover:bg-blue-500",
      )}
      onClick={onClick}
    >
      <span>{getBasename(file)}</span>
      <Button className="cursor-pointer" onClick={() => setOpen(true)}>
        <Image />
      </Button>
    </div>
  );
}
