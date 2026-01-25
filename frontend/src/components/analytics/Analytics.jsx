import React from "react";
import { Box, Heading, Text } from "@chakra-ui/react";
import Layout from "../Layout";
import LoadingSpinner from "../shared/LoadingSpinner";
import { useAnalytics } from "../../hooks/useAnalytics";
import AnalyticsContent from "./AnalyticsContent";

const Analytics = () => {
  const {
    monthly,
    topProducts,
    loading,
    error,
    year,
    monthsRange,
    setYear,
    setMonthsRange,
    getInsights,
  } = useAnalytics();

  // Обработка состояний загрузки и ошибок
  if (loading) {
    return (
      <Layout>
        <LoadingSpinner text="Загрузка аналитики..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Box textAlign="center" py={10}>
          <Heading size="lg" mb={4}>
            Аналитика
          </Heading>
          <Text color="red.500">{error}</Text>
          <Text fontSize="sm" color="gray.500" mt={2}>
            Пожалуйста, проверьте подключение к серверу
          </Text>
        </Box>
      </Layout>
    );
  }

  // Основной контент
  return (
    <Layout>
      <AnalyticsContent
        monthly={monthly}
        topProducts={topProducts}
        year={year}
        monthsRange={monthsRange}
        setYear={setYear}
        setMonthsRange={setMonthsRange}
        getInsights={getInsights}
      />
    </Layout>
  );
};

export default Analytics;
