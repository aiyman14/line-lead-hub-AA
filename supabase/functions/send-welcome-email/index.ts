import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resendClient = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const welcomeEmailSchema = z.object({
  email: z.string().email("Invalid email format").max(255, "Email too long"),
  fullName: z.string().min(1, "Name is required").max(100, "Name too long"),
  resetLink: z.string().url("Invalid reset link URL").max(2000, "URL too long"),
  factoryName: z.string().max(100, "Factory name too long").optional(),
});

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Validate input
    const validation = welcomeEmailSchema.safeParse(rawBody);
    
    if (!validation.success) {
      const errors = validation.error.errors.map(e => e.message).join(", ");
      console.error("Validation failed:", errors);
      return new Response(
        JSON.stringify({ success: false, error: `Invalid input: ${errors}` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { email, fullName, resetLink, factoryName } = validation.data;

    console.log(`Sending welcome email to ${email}`);

    const emailResponse = await resendClient.emails.send({
      from: "Woventex <noreply@woventex.co>",
      to: [email],
      subject: `Welcome to ${factoryName || 'Factory Updates'}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${factoryName || 'Factory Updates'}!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${fullName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              You've been invited to join the production tracking system. To get started, please set up your password by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                Set Your Password
              </a>
            </div>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Your Email:</strong> ${email}</p>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Use this email address to log in after setting your password.</p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
              This link will expire in 24 hours. If you didn't request this invitation, you can safely ignore this email.
            </p>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you have any questions, please contact your administrator.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to send email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
