import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { useContext, useState } from "react";
import { AuthContext } from "../../App";
import { useGetActiveChat, useUpdateChat } from "../../../app/queries/chats";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import UserFileCollection from "@/app/workspaces/[id]/components/UserFileCollection";

function ChatTopMenu({ displayState = "full", readOnly = false }) {
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);
    const { data: chat } = useGetActiveChat();
    const activeChatId = chat?._id;
    const updateChatHook = useUpdateChat();
    const [showFileCollectionDialog, setShowFileCollectionDialog] =
        useState(false);

    return (
        <>
            <div className="flex items-center gap-1.5">
                <button
                    onClick={() => setShowFileCollectionDialog(true)}
                    disabled={readOnly}
                    className="flex items-center gap-1.5 justify-center px-2.5 py-1.5 rounded-md transition-colors border bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700"
                    title={
                        readOnly ? t("Read-only mode") : t("View Chat Files")
                    }
                >
                    <FileText className="w-5 h-5" />
                    <span className="text-sm font-medium">{t("Files")}</span>
                </button>
            </div>

            <Dialog
                open={showFileCollectionDialog}
                onOpenChange={setShowFileCollectionDialog}
            >
                <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-full max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>{t("Chat Files")}</DialogTitle>
                        <DialogDescription>
                            {t(
                                "View and manage files that are available to this conversation.",
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {user?.contextId && (
                            <UserFileCollection
                                contextId={user.contextId}
                                contextKey={user.contextKey}
                                chatId={
                                    activeChatId ? String(activeChatId) : null
                                }
                                messages={chat?.messages || []}
                                updateChatHook={updateChatHook}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default ChatTopMenu;
