
const MAX_BODY_LENGTH = 12000;

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      success: false,
      message: "허용되지 않은 요청입니다."
    });
  }

  const webAppUrl = process.env.GAS_WEB_APP_URL;
  const secret = process.env.SUBMISSION_SECRET;

  if (!webAppUrl || !secret) {
    console.error("Missing server configuration");

    return jsonResponse(500, {
      success: false,
      message: "서버 설정이 완료되지 않았습니다."
    });
  }

  let data;

  try {
    const raw = event.body || "";

    if (raw.length > MAX_BODY_LENGTH) {
      return jsonResponse(413, {
        success: false,
        message: "입력 내용이 너무 깁니다."
      });
    }

    data = JSON.parse(raw);
  } catch (error) {
    return jsonResponse(400, {
      success: false,
      message: "요청 형식이 올바르지 않습니다."
    });
  }

  const clean = value => {
    return typeof value === "string" ? value.trim() : "";
  };

  const payload = {
    studentId: clean(data.studentId),
    studentName: clean(data.studentName),
    activity: clean(data.activity),
    lesson: clean(data.lesson),
    method: clean(data.method),
    message: clean(data.message),
    website: clean(data.website)
  };

  // 숨겨진 스팸 방지 입력칸
  if (payload.website) {
    return jsonResponse(400, {
      success: false,
      message: "제출 요청을 처리할 수 없습니다."
    });
  }

  if (!/^[0-9]{5}$/.test(payload.studentId)) {
    return jsonResponse(400, {
      success: false,
      message: "학번은 숫자 5자리로 입력해주세요."
    });
  }

  if (!payload.studentName ||
      !payload.activity ||
      !payload.lesson ||
      !payload.message) {
    return jsonResponse(400, {
      success: false,
      message: "필수 항목을 모두 작성해주세요."
    });
  }

  if (payload.studentName.length > 30 ||
      ["activity", "lesson", "method", "message"]
        .some(key => payload[key].length > 2000)) {
    return jsonResponse(400, {
      success: false,
      message: "입력 가능한 글자 수를 초과했습니다."
    });
  }

  try {
    const response = await fetch(webAppUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        ...payload,
        secret
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      throw new Error("Google endpoint HTTP " + response.status);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.error || "Google rejected submission"
      );
    }

    return jsonResponse(200, {
      success: true,
      message: "소감이 저장되었습니다."
    });

  } catch (error) {
    console.error("Google submission failed:", error);

    return jsonResponse(502, {
      success: false,
      message: "저장 완료를 확인할 수 없습니다."
    });
  }
};
