import React from "react";
import PropTypes from "prop-types";
import {
  Card,
  CardBody,
  Heading,
  VStack,
  useColorModeValue,
  Icon,
} from "@chakra-ui/react";
import { FaReceipt } from "react-icons/fa";
import ReceiptItem from "./ReceiptItem";
import EmptyState from "../shared/EmptyState";

const RecentReceipts = ({ receipts }) => {
  return (
    <Card bg={useColorModeValue("white", "gray.800")} shadow="sm">
      <CardBody>
        <Heading size="md" mb={4} display="flex" alignItems="center" gap={2}>
          <Icon as={FaReceipt} /> Последние чеки
        </Heading>

        {receipts.length > 0 ? (
          <VStack align="stretch" spacing={3}>
            {receipts.slice(0, 10).map((receipt) => (
              <ReceiptItem key={receipt.id} receipt={receipt} />
            ))}
          </VStack>
        ) : (
          <EmptyState
            title="Пока нет чеков"
            description='Загрузите первый чек в разделе "Чеки"'
          />
        )}
      </CardBody>
    </Card>
  );
};

RecentReceipts.propTypes = {
  receipts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      total_sum_rub: PropTypes.number.isRequired,
      cash_total_sum: PropTypes.number,
      shop_name: PropTypes.string.isRequired,
      shop_chain: PropTypes.string,
      cashier_name: PropTypes.string,
      items_count: PropTypes.number.isRequired,
      date_time: PropTypes.string,
    }),
  ).isRequired,
};

export default RecentReceipts;
