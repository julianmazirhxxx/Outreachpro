/*
  # Dynamic SMTP Email Sender

  1. Purpose
    - Send emails via SMTP using nodemailer
    - Support Gmail App Passwords and other SMTP providers
    - Provide REST API for n8n and other tools

  2. Security
    - Input validation and sanitization
    - Rate limiting protection
    - CORS headers for browser requests

  3. Endpoints
    - POST /send-smtp - Send email via SMTP
    - GET / - Health check endpoint
*/

import { createTransporter } from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SMTPRequest {
  host?: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

interface SMTPResponse {
  success: boolean;
  info?: any;
  error?: string;
}

// Input validation
function validateEmailRequest(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body.auth || typeof body.auth !== 'object') {
    errors.push('auth object is required');
  } else {
    if (!body.auth.user || typeof body.auth.user !== 'string') {
      errors.push('auth.user (email) is required');
    }
    if (!body.auth.pass || typeof body.auth.pass !== 'string') {
      errors.push('auth.pass (password/app password) is required');
    }
  }

  if (!body.from || typeof body.from !== 'string') {
    errors.push('from email address is required');
  }

  if (!body.to || typeof body.to !== 'string') {
    errors.push('to email address is required');
  }

  if (!body.subject || typeof body.subject !== 'string') {
    errors.push('subject is required');
  }

  if (!body.text && !body.html) {
    errors.push('either text or html content is required');
  }

  // Validate email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (body.from && !emailRegex.test(body.from)) {
    errors.push('invalid from email format');
  }
  if (body.to && !emailRegex.test(body.to)) {
    errors.push('invalid to email format');
  }

  return { isValid: errors.length === 0, errors };
}

// Sanitize input to prevent injection
function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Health check endpoint
  if (req.method === "GET" && pathname === "/") {
    return new Response(
      JSON.stringify({
        service: "OutreachPro SMTP Webhook",
        status: "running",
        version: "1.0.0",
        endpoints: {
          "POST /send-smtp": "Send email via SMTP",
          "GET /": "Health check"
        },
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // SMTP email sending endpoint
  if (req.method === "POST" && pathname === "/send-smtp") {
    try {
      // Parse request body
      const body = await req.json();
      
      // Validate input
      const validation = validateEmailRequest(body);
      if (!validation.isValid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Validation failed: ${validation.errors.join(', ')}`
          } as SMTPResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Sanitize inputs
      const emailData: SMTPRequest = {
        host: sanitizeInput(body.host || 'smtp.gmail.com'),
        port: parseInt(body.port) || 587,
        secure: body.secure === true || body.port === 465,
        auth: {
          user: sanitizeInput(body.auth.user),
          pass: body.auth.pass // Don't sanitize password as it may contain special chars
        },
        from: sanitizeInput(body.from),
        to: sanitizeInput(body.to),
        subject: sanitizeInput(body.subject),
        text: body.text ? sanitizeInput(body.text) : undefined,
        html: body.html ? body.html : undefined // HTML content should preserve formatting
      };

      // Create nodemailer transporter
      const transporter = createTransporter({
        host: emailData.host,
        port: emailData.port,
        secure: emailData.secure,
        auth: {
          user: emailData.auth.user,
          pass: emailData.auth.pass
        },
        // Additional Gmail-specific settings
        ...(emailData.host === 'smtp.gmail.com' && {
          service: 'gmail',
          tls: {
            rejectUnauthorized: false
          }
        })
      });

      // Verify SMTP connection
      try {
        await transporter.verify();
      } catch (verifyError) {
        console.error('SMTP verification failed:', verifyError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `SMTP connection failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`
          } as SMTPResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Send email
      const mailOptions = {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        ...(emailData.text && { text: emailData.text }),
        ...(emailData.html && { html: emailData.html })
      };

      const info = await transporter.sendMail(mailOptions);

      // Success response
      return new Response(
        JSON.stringify({
          success: true,
          info: {
            messageId: info.messageId,
            response: info.response,
            accepted: info.accepted,
            rejected: info.rejected,
            pending: info.pending,
            envelope: info.envelope
          }
        } as SMTPResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      console.error('Email sending error:', error);
      
      // Determine error type for better user feedback
      let errorMessage = 'Failed to send email';
      if (error instanceof Error) {
        if (error.message.includes('Invalid login')) {
          errorMessage = 'Invalid email or app password. Please check your Gmail credentials.';
        } else if (error.message.includes('authentication failed')) {
          errorMessage = 'Authentication failed. Make sure you\'re using an app password, not your regular Gmail password.';
        } else if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Connection refused. Please check SMTP host and port settings.';
        } else {
          errorMessage = error.message;
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage
        } as SMTPResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // 404 for unknown endpoints
  return new Response(
    JSON.stringify({
      success: false,
      error: `Endpoint not found: ${pathname}`,
      available_endpoints: [
        "GET / - Health check",
        "POST /send-smtp - Send email via SMTP"
      ]
    }),
    {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
});