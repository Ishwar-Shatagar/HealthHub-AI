// Mock Email Service for demonstration purposes

export const sendEmail = async (to: string, subject: string, body: string): Promise<boolean> => {
    console.log(`Mock: Sending email to ${to}...`);
    console.log(`Subject: ${subject}`);
    await new Promise(res => setTimeout(res, 1000));
    return true;
};

export const sendHealthAlert = async (userEmail: string, alertType: string, details: any): Promise<void> => {
    console.log(`Mock: Sending health alert (${alertType}) to ${userEmail}`);
};

export const sendDailyReport = async (userEmail: string, reportData: any): Promise<void> => {
    console.log(`Mock: Sending daily report to ${userEmail}`, reportData);
};
