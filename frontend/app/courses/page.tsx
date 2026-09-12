/**
 * The page that shows all courses for sale
*/

// app/courses/page.tsx
"use client";

import { useCourses } from "@/lib/api/services/courses";
import { StatusMessage } from "@/components/StatusMessage";
import { formatMoney, formatNullableNumber } from "@/lib/format";

export default function CoursesPage() {
  const { data, isLoading, isError, error } = useCourses();

  if (isLoading) {
    return <StatusMessage state="loading" />;
  }

  if (isError) {
    return (
      <StatusMessage
        state="error"
        message={
          error instanceof Error
            ? `Could not load courses: ${error.message}`
            : "Could not load courses."
        }
      />
    );
  }

  if (!data || data.courses.length === 0) {
    return <StatusMessage state="empty" message="No courses available yet." />;
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Courses</h1>
      <ul className="divide-y divide-slate-200">
        {data.courses.map((course) => (
          <li key={course.id} className="py-4">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{course.title}</p>
                <p className="text-sm text-slate-500">{course.instructorName}</p>
              </div>
              <p className="font-medium">
                {formatMoney(course.priceMinor, course.currency)}
              </p>
            </div>
            <div className="mt-1 flex gap-4 text-sm text-slate-500">
              <span>Enrolled: {formatNullableNumber(course.enrolmentCount)}</span>
              <span>Rating: {formatNullableNumber(course.averageRating)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}