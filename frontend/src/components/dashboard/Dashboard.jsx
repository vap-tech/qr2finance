import React from "react";
import { Grid, GridItem, Heading } from "@chakra-ui/react";
import Layout from "../Layout";
import LoadingSpinner from "../shared/LoadingSpinner";
import { useDashboardData } from "../../hooks/useDashboardData";
import DashboardStats from "./DashboardStats";
import RecentReceipts from "./RecentReceipts";
import StoreStatistics from "./StoreStatistics";

const Dashboard = () => {
  const { stats, recentReceipts, loading } = useDashboardData();

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner text="Загрузка дашборда..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <Heading mb={6} size="xl">
        📊 Дашборд
      </Heading>

      <DashboardStats stats={stats} />

      <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={6}>
        <GridItem>
          <RecentReceipts receipts={recentReceipts} />
        </GridItem>

        <GridItem>
          <StoreStatistics receipts={recentReceipts} stats={stats} />
        </GridItem>
      </Grid>
    </Layout>
  );
};

export default Dashboard;
