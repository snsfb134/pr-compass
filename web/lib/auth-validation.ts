export type AuthFieldErrors = {
  username?: string;
  email?: string;
  identifier?: string;
  password?: string;
};

export type AuthValidationResult = {
  valid: true;
  value: {
    username: string;
    email: string;
    identifier: string;
    password: string;
  };
} | {
  valid: false;
  message: string;
  fieldErrors: AuthFieldErrors;
};

const usernamePattern = /^[A-Za-z0-9_-]{3,24}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordLetterPattern = /[A-Za-z]/;
const passwordNumberPattern = /[0-9]/;

function buildError(fieldErrors: AuthFieldErrors, message = "입력값을 확인해 주세요."): AuthValidationResult {
  return {
    valid: false,
    message,
    fieldErrors,
  };
}

export function validateSignupInput(username: string, email: string, password: string): AuthValidationResult {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  const fieldErrors: AuthFieldErrors = {};

  if (!cleanUsername) {
    fieldErrors.username = "아이디를 입력해 주세요.";
  } else if (!usernamePattern.test(cleanUsername)) {
    fieldErrors.username = "아이디는 3-24자 영문, 숫자, underscore, hyphen만 사용할 수 있습니다.";
  }

  if (!cleanEmail) {
    fieldErrors.email = "이메일을 입력해 주세요.";
  } else if (!emailPattern.test(cleanEmail)) {
    fieldErrors.email = "이메일 형식이 올바르지 않습니다.";
  }

  if (!password) {
    fieldErrors.password = "비밀번호를 입력해 주세요.";
  } else {
    if (password.length < 8) {
      fieldErrors.password = "비밀번호는 8자 이상이어야 합니다.";
    } else if (!passwordLetterPattern.test(password) || !passwordNumberPattern.test(password)) {
      fieldErrors.password = "비밀번호는 영문과 숫자를 각각 1개 이상 포함해야 합니다.";
    }
  }

  if (Object.keys(fieldErrors).length) {
    return buildError(fieldErrors, "회원가입 정보를 확인해 주세요.");
  }

  return {
    valid: true,
    value: {
      username: cleanUsername,
      email: cleanEmail,
      identifier: "",
      password,
    },
  };
}

export function validateLoginInput(identifier: string, password: string): AuthValidationResult {
  const cleanIdentifier = identifier.trim();
  const fieldErrors: AuthFieldErrors = {};

  if (!cleanIdentifier) {
    fieldErrors.identifier = "아이디 또는 이메일을 입력해 주세요.";
  }
  if (!password) {
    fieldErrors.password = "비밀번호를 입력해 주세요.";
  }

  if (Object.keys(fieldErrors).length) {
    return buildError(fieldErrors, "로그인 정보를 확인해 주세요.");
  }

  return {
    valid: true,
    value: {
      username: "",
      email: "",
      identifier: cleanIdentifier,
      password,
    },
  };
}
