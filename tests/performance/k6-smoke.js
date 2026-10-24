import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = (__ENV.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const studentPath = __ENV.STUDENT_PATH || "/ar/student/progress";
const authCookie = __ENV.AUTH_COOKIE || "";

export const options = {
  scenarios: {
    public_pages: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
      exec: "publicPages",
    },
    ...(authCookie
      ? {
          student_profile: {
            executor: "constant-vus",
            vus: 3,
            duration: "30s",
            exec: "studentProfile",
          },
        }
      : {}),
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
  },
};

export function publicPages() {
  for (const path of ["/ar", "/en", "/ar/contact"]) {
    const response = http.get(`${baseUrl}${path}`, { redirects: 2 });
    check(response, { [`${path} returns 200`]: (result) => result.status === 200 });
  }
  sleep(1);
}

export function studentProfile() {
  const response = http.get(`${baseUrl}${studentPath}`, {
    headers: { Cookie: authCookie },
    redirects: 0,
  });
  check(response, {
    "student profile returns 200": (result) => result.status === 200,
    "student profile is not redirected": (result) => result.status < 300,
  });
  sleep(1);
}
