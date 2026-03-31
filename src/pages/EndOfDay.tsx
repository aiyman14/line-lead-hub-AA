import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { getTodayInTimezone } from "@/lib/date-utils";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SewingEndOfDayForm from "@/components/forms/SewingEndOfDayForm";
import FinishingEndOfDayForm from "@/components/forms/FinishingEndOfDayForm";

export default function EndOfDay() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { factory } = useAuth();
  const [activeTab, setActiveTab] = useState("sewing");

  const dateLocale = i18n.language === 'bn' ? 'bn-BD' : 'en-US';

  return (
    <div className="container max-w-2xl py-4 px-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t("forms.endOfDayOutput")}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(getTodayInTimezone(factory?.timezone || "Asia/Dhaka") + "T00:00:00").toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="sewing">{t("forms.sewing")}</TabsTrigger>
          <TabsTrigger value="finishing">{t("forms.finishing")}</TabsTrigger>
        </TabsList>

        <TabsContent value="sewing">
          <SewingEndOfDayForm />
        </TabsContent>

        <TabsContent value="finishing">
          <FinishingEndOfDayForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
