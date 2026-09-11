import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { CourseListResponse } from "@/lib/types/api";

async function fetchCourses(): Promise<CourseListResponse> {
  const response = await api.get<CourseListResponse>("/courses");
  return response.data;
}

export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: fetchCourses,
    refetchInterval: (query) => {
      const seconds = query.state.data?.previewExpiresInSeconds;
      return seconds ? seconds * 1000 : false;
    },
  });
}