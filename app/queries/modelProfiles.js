import { useQuery } from "@tanstack/react-query";
import axios from "../utils/axios-client";

export function useModelProfiles() {
    return useQuery({
        queryKey: ["modelProfiles"],
        queryFn: async () => {
            const response = await axios.get("/api/model-profiles");
            return response.data;
        },
        staleTime: Infinity,
    });
}
