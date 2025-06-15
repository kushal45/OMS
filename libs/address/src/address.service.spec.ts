import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, DeepPartial, EntityManager } from 'typeorm'; // Imported DeepPartial and EntityManager
import { UnprocessableEntityException } from '@nestjs/common';

import { AddressService } from './address.service';
import { AddressRepository } from './repository/address.repository';
import { CustomerAddressRepository } from './repository/customerAddress.respository';
import { Address } from './entity/address.entity';
import { CustomerAddress } from './entity/customerAdress.entity';
import { Customer } from '@app/auth/src/entity/customer.entity'; // Dependency for CustomerAddress
import { TransactionService } from '@app/utils/transaction.service';
import { LoggerService } from '@lib/logger/src';

// Centralized Test DB Utilities
import GlobalTestOrmConfigService from '@lib/test-utils/src/orm.config.test';
import { initializeDatabase } from '@lib/test-utils/src/test-db-setup.util';

// Mocks
const mockLoggerService = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('AddressService', () => {
  let service: AddressService;
  let dataSource: DataSource;
  let addressRepository: AddressRepository;
  let customerAddressRepository: CustomerAddressRepository;
  let transactionService: TransactionService;
  // Raw repositories for direct DB interaction
  let rawAddressRepository: Repository<Address>;
  let rawCustomerAddressRepository: Repository<CustomerAddress>;
  let rawCustomerRepository: Repository<Customer>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useClass: GlobalTestOrmConfigService,
          dataSourceFactory: async (options) => new DataSource(options),
        }),
        TypeOrmModule.forFeature([Address, CustomerAddress, Customer]),
      ],
      providers: [
        AddressService,
        AddressRepository,
        CustomerAddressRepository,
        TransactionService,
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<AddressService>(AddressService);
    dataSource = module.get<DataSource>(DataSource);
    addressRepository = module.get<AddressRepository>(AddressRepository);
    customerAddressRepository = module.get<CustomerAddressRepository>(CustomerAddressRepository);
    transactionService = module.get<TransactionService>(TransactionService);

    rawAddressRepository = module.get<Repository<Address>>(getRepositoryToken(Address));
    rawCustomerAddressRepository = module.get<Repository<CustomerAddress>>(getRepositoryToken(CustomerAddress));
    rawCustomerRepository = module.get<Repository<Customer>>(getRepositoryToken(Customer));
  });

  beforeEach(async () => {
    await initializeDatabase(dataSource);
    jest.clearAllMocks(); // Clear mocks, especially logger
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAddress', () => {
    let testCustomer: Customer;

    beforeEach(async () => {
      testCustomer = await rawCustomerRepository.save(rawCustomerRepository.create({ name: 'Addr Test User', email: 'addr@example.com', password: 'password' }));
    });

    it('should create an address and link it to a user', async () => {
      const addressData: Partial<Address> = { street: '1 Test St', city: 'Testcity', state: 'Teststate', country: 'Testland', pincode: '11111' };
      const createdAddress = await service.createAddress(addressData, testCustomer.id);

      expect(createdAddress).toBeDefined();
      expect(createdAddress.id).toBeDefined();
      expect(createdAddress.street).toEqual(addressData.street);

      const dbAddress = await rawAddressRepository.findOneBy({ id: createdAddress.id });
      expect(dbAddress).toBeDefined();

      const dbCustomerAddress = await rawCustomerAddressRepository.findOneBy({ userId: testCustomer.id, addressId: createdAddress.id });
      expect(dbCustomerAddress).toBeDefined();
      expect(dbCustomerAddress.userId).toEqual(testCustomer.id);
      expect(dbCustomerAddress.addressId).toEqual(createdAddress.id);
      expect(mockLoggerService.info).toHaveBeenCalledTimes(2); // Called at beginning and end
    });

    it('should rollback transaction if linking customer to address fails (simulated)', async () => {
      const addressData: Partial<Address> = { street: '2 Fail St', city: 'Failcity', state: 'Failstate', country: 'Testland', pincode: '22222' };

      // 1. Mock the 'create' method of the CustomerAddressRepository instance that will be returned by getRepository
      const mockTransactionalCustomerAddressRepoInstance = {
        // This 'create' is the method on the custom CustomerAddressRepository class, not TypeORM's Repository.create
        // According to CustomerAddressRepository, its 'create' method calls this.custAddressRepo.create AND .save
        create: jest.fn(async (_addressObj: Partial<CustomerAddress>): Promise<CustomerAddress> => {
          throw new Error('Simulated DB error during CustomerAddress creation in transaction');
        }),
        // Add other methods of CustomerAddressRepository if they are called by AddressService within the transaction
        // For now, AddressService calls .create() on the result of getRepository()
      };

      // 2. Mock the 'create' method of the AddressRepository instance
      // This one should "succeed" (i.e., not throw) for the first part of the transaction.
      // The actual AddressService.createAddress calls `addressRepository.create(address)` which is synchronous
      // and doesn't save. The real save happens in the custom repo's create method.
      // So, we mock the custom AddressRepository's create method.
      const mockTransactionalAddressRepoInstance = {
        create: jest.fn(async (addressObj: Partial<Address>): Promise<Address> => {
          // Simulate successful creation and save for the Address part
          const newAddress = rawAddressRepository.create(addressObj);
          return rawAddressRepository.save(newAddress); // Simulate it being saved
        }),
      };
      
      // 3. Spy on customerAddressRepository.getRepository (the one injected into AddressService)
      const getCustomerAddressRepoSpy = jest.spyOn(customerAddressRepository, 'getRepository')
        .mockImplementation((_entityManager: EntityManager): CustomerAddressRepository => {
          return mockTransactionalCustomerAddressRepoInstance as unknown as CustomerAddressRepository;
        });

      // 4. Spy on addressRepository.getRepository
      const getAddressRepoSpy = jest.spyOn(addressRepository, 'getRepository')
        .mockImplementation((_entityManager: EntityManager): AddressRepository => {
          return mockTransactionalAddressRepoInstance as unknown as AddressRepository;
        });

      // Expect the service call to fail
      await expect(service.createAddress(addressData, testCustomer.id))
        .rejects.toThrow('Simulated DB error during CustomerAddress creation in transaction');
      
      // Verify that the Address (addressData) was not persisted due to the transaction rollback.
      const dbAddress = await rawAddressRepository.findOneBy({ street: '2 Fail St' });
      expect(dbAddress).toBeNull(); // Nothing should be committed

      const dbCustomerAddresses = await rawCustomerAddressRepository.findBy({ userId: testCustomer.id });
      expect(dbCustomerAddresses.length).toBe(0); // No link should be committed

      // Restore spies
      getCustomerAddressRepoSpy.mockRestore();
      getAddressRepoSpy.mockRestore();
    });
  });

  describe('fetchUserAddress', () => {
    let testCustomer: Customer;
    let address1: Address;
    let address2: Address;

    beforeEach(async () => {
      testCustomer = await rawCustomerRepository.save(rawCustomerRepository.create({ name: 'Fetch User', email: 'fetch@example.com', password: 'password' }));
      address1 = await rawAddressRepository.save(rawAddressRepository.create({ street: 'Street 1', city: 'CityA', state: 'StateA', country: 'CountryA', pincode: '00001' }));
      address2 = await rawAddressRepository.save(rawAddressRepository.create({ street: 'Street 2', city: 'CityB', state: 'StateB', country: 'CountryB', pincode: '00002' }));
      await rawCustomerAddressRepository.save(rawCustomerAddressRepository.create({ userId: testCustomer.id, addressId: address1.id }));
      await rawCustomerAddressRepository.save(rawCustomerAddressRepository.create({ userId: testCustomer.id, addressId: address2.id }));
    });

    it('should fetch all addresses for a given user', async () => {
      const userAddresses = await service.fetchUserAddress(testCustomer.id);
      expect(userAddresses).toBeDefined();
      expect(userAddresses.length).toBe(2);
      const fetchedAddressIds = userAddresses.map(ua => ua.addressId);
      expect(fetchedAddressIds).toContain(address1.id);
      expect(fetchedAddressIds).toContain(address2.id);
    });

    it('should return an empty array if user has no addresses', async () => {
      const newUser = await rawCustomerRepository.save(rawCustomerRepository.create({ name: 'No Addr User', email: 'noaddr@example.com', password: 'password' }));
      const userAddresses = await service.fetchUserAddress(newUser.id);
      expect(userAddresses).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update an existing address', async () => {
      const originalAddress = await rawAddressRepository.save(rawAddressRepository.create({ street: 'Old Street', city: 'Old City', state: 'Old State', country: 'Old Country', pincode: '99999' }));
      const updateData: Partial<Address> = { street: 'New Street', city: 'New City' };
      const updatedAddress = await service.update(originalAddress.id, updateData);

      expect(updatedAddress).toBeDefined();
      expect(updatedAddress.street).toEqual('New Street');
      expect(updatedAddress.city).toEqual('New City');
      expect(updatedAddress.pincode).toEqual('99999'); // Unchanged

      const dbAddress = await rawAddressRepository.findOneBy({ id: originalAddress.id });
      expect(dbAddress.street).toEqual('New Street');
    });

     it('should return null or throw if address to update is not found (depending on repository)', async () => {
        // This depends on AddressRepository.update behavior for non-existent ID
        const result = await service.update(8888, { city: 'Ghost Town' });
        expect(result).toBeNull(); // Or expect a specific error
    });
  });

  describe('delete', () => {
    let testCustomer: Customer;
    let addressToDelete: Address;

    beforeEach(async () => {
      testCustomer = await rawCustomerRepository.save(rawCustomerRepository.create({ name: 'Delete User', email: 'delete@example.com', password: 'password' }));
      addressToDelete = await rawAddressRepository.save(rawAddressRepository.create({ street: 'Delete St', city: 'Deleteville', state: 'DelState', country: 'DelLand', pincode: '40404' }));
      await rawCustomerAddressRepository.save(rawCustomerAddressRepository.create({ userId: testCustomer.id, addressId: addressToDelete.id }));
    });

    it('should delete an address and its user link', async () => {
      const result = await service.delete(testCustomer.id, addressToDelete.id);
      expect(result).toBe(true);

      const dbAddress = await rawAddressRepository.findOneBy({ id: addressToDelete.id });
      expect(dbAddress).toBeNull();
      const dbCustomerAddress = await rawCustomerAddressRepository.findOneBy({ userId: testCustomer.id, addressId: addressToDelete.id });
      expect(dbCustomerAddress).toBeNull();
    });

    it('should return false if address link to delete is not found', async () => {
      const result = await service.delete(testCustomer.id, 98765); // Non-existent addressId for this user
      expect(result).toBe(false); // Or true if only address deletion matters and CustomerAddress deletion fails silently
                                  // The service's delete method returns isAddressDeleted && isCustEntityDeleted
    });
  });

  describe('isValidAddress', () => {
    let testCustomer: Customer;
    let validAddress: Address;

    beforeEach(async () => {
      testCustomer = await rawCustomerRepository.save(rawCustomerRepository.create({ name: 'Valid User', email: 'valid@example.com', password: 'password' }));
      validAddress = await rawAddressRepository.save(rawAddressRepository.create({ street: 'Valid St', city: 'Validville', state: 'ValidState', country: 'ValidLand', pincode: '01010' }));
      await rawCustomerAddressRepository.save(rawCustomerAddressRepository.create({ userId: testCustomer.id, addressId: validAddress.id }));
    });

    it('should return true if address is valid for the user', async () => {
      const isValid = await service.isValidAddress(testCustomer.id, validAddress.id);
      expect(isValid).toBe(true);
    });

    it('should return false if address is not linked to the user', async () => {
      const otherAddress = await rawAddressRepository.save(rawAddressRepository.create({ street: 'Other St', city: 'OtherCity', state: 'OtherState', country: 'OtherCountry', pincode: '02020' }));
      const isValid = await service.isValidAddress(testCustomer.id, otherAddress.id);
      expect(isValid).toBe(false);
    });

    it('should return false if user does not exist', async () => {
      const isValid = await service.isValidAddress(9999, validAddress.id);
      expect(isValid).toBe(false);
    });

    it('should return false if address does not exist', async () => {
      const isValid = await service.isValidAddress(testCustomer.id, 8888);
      expect(isValid).toBe(false);
    });
  });
});
