"use client";

import { createContext, useContext, useState } from "react";

const ChatEntityContext = createContext({
    entityId: null,
    entityName: null,
    entity: null,
    isEntityUnavailable: false,
    setChatEntity: () => {},
});

export function ChatEntityProvider({ children }) {
    const [entityId, setEntityId] = useState(null);
    const [entityName, setEntityName] = useState(null);
    const [entity, setEntity] = useState(null);
    const [isEntityUnavailable, setIsEntityUnavailable] = useState(false);

    const setChatEntity = (info) => {
        setEntityId(info?.entityId || null);
        setEntityName(info?.entityName || null);
        setEntity(info?.entity || null);
        setIsEntityUnavailable(info?.isEntityUnavailable || false);
    };

    return (
        <ChatEntityContext.Provider
            value={{
                entityId,
                entityName,
                entity,
                isEntityUnavailable,
                setChatEntity,
            }}
        >
            {children}
        </ChatEntityContext.Provider>
    );
}

export function useChatEntity() {
    return useContext(ChatEntityContext);
}
